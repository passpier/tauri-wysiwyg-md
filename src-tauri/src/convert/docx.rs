use std::fs::File;
use std::io::BufWriter;

use docx_rs::{
    read_docx, DocumentChild, Docx, Paragraph, ParagraphChild, Run, RunChild, Table,
    TableCell, TableCellContent, TableChild, TableRow, TableRowChild,
};
use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};

use super::ConversionError;

/// Convert a DOCX file to Markdown text.
///
/// Known limitations (by design, not surfaced as errors):
/// - Images are skipped
/// - Track changes, comments, footnotes are dropped
/// - Complex layouts (text boxes, columns) may have scrambled order
pub fn docx_to_markdown(path: &str) -> Result<String, ConversionError> {
    let bytes =
        std::fs::read(path).map_err(|e| ConversionError(format!("Failed to read file: {}", e)))?;

    let docx = read_docx(&bytes)
        .map_err(|e| ConversionError(format!("Failed to parse DOCX: {:?}", e)))?;

    let mut output = String::new();
    let mut first_block = true;

    for child in &docx.document.children {
        match child {
            DocumentChild::Paragraph(para) => {
                let md = paragraph_to_markdown(para);
                if md.trim().is_empty() {
                    if !first_block {
                        output.push('\n');
                    }
                } else {
                    if !first_block {
                        output.push('\n');
                    }
                    output.push_str(&md);
                    output.push('\n');
                    first_block = false;
                }
            }
            DocumentChild::Table(table) => {
                if !first_block {
                    output.push('\n');
                }
                output.push_str(&table_to_markdown(table));
                output.push('\n');
                first_block = false;
            }
            _ => {}
        }
    }

    Ok(output)
}

fn paragraph_to_markdown(para: &Paragraph) -> String {
    // Detect heading level from style ID
    let heading_prefix = para
        .property
        .style
        .as_ref()
        .map(|s| {
            match s.val.to_lowercase().as_str() {
                "heading1" | "heading 1" => "# ",
                "heading2" | "heading 2" => "## ",
                "heading3" | "heading 3" => "### ",
                "heading4" | "heading 4" => "#### ",
                "heading5" | "heading 5" => "##### ",
                "heading6" | "heading 6" => "###### ",
                _ => "",
            }
        })
        .unwrap_or("");

    let mut text = String::new();
    for child in &para.children {
        if let ParagraphChild::Run(run) = child {
            text.push_str(&run_to_markdown(run));
        }
    }

    if text.is_empty() {
        String::new()
    } else {
        format!("{}{}", heading_prefix, text)
    }
}

fn run_to_markdown(run: &Run) -> String {
    let mut text = String::new();
    for child in &run.children {
        match child {
            RunChild::Text(t) => text.push_str(&t.text),
            RunChild::Tab(_) => text.push('\t'),
            // Skip images and other complex children
            _ => {}
        }
    }

    if text.is_empty() {
        return String::new();
    }

    // Bold.val is private; presence of Some(_) indicates bold is set
    let bold = run.run_property.bold.is_some();
    let italic = run.run_property.italic.is_some();

    match (bold, italic) {
        (true, true) => format!("***{}***", text),
        (true, false) => format!("**{}**", text),
        (false, true) => format!("*{}*", text),
        (false, false) => text,
    }
}

fn table_to_markdown(table: &Table) -> String {
    let mut rows: Vec<Vec<String>> = Vec::new();

    for row_child in &table.rows {
        let TableChild::TableRow(table_row) = row_child;
        let mut cells: Vec<String> = Vec::new();
        for cell_child in &table_row.cells {
            let TableRowChild::TableCell(table_cell) = cell_child;
            let mut cell_text = String::new();
            for content in &table_cell.children {
                if let TableCellContent::Paragraph(para) = content {
                    let p = paragraph_to_markdown(para);
                    if !p.is_empty() {
                        if !cell_text.is_empty() {
                            cell_text.push(' ');
                        }
                        cell_text.push_str(p.trim());
                    }
                }
            }
            cells.push(cell_text);
        }
        if !cells.is_empty() {
            rows.push(cells);
        }
    }

    if rows.is_empty() {
        return String::new();
    }

    let col_count = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    if col_count == 0 {
        return String::new();
    }

    let mut md = String::new();

    // Header row
    let header = &rows[0];
    md.push('|');
    for i in 0..col_count {
        let cell = header.get(i).map(|s| s.as_str()).unwrap_or("");
        md.push_str(&format!(" {} |", cell));
    }
    md.push('\n');

    // Separator
    md.push('|');
    for _ in 0..col_count {
        md.push_str(" --- |");
    }
    md.push('\n');

    // Data rows
    for row in rows.iter().skip(1) {
        md.push('|');
        for i in 0..col_count {
            let cell = row.get(i).map(|s| s.as_str()).unwrap_or("");
            md.push_str(&format!(" {} |", cell));
        }
        md.push('\n');
    }

    md
}

/// Convert Markdown to a DOCX file.
pub fn markdown_to_docx(markdown: &str, path: &str) -> Result<(), ConversionError> {
    let mut docx = Docx::new();

    let options = Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH;
    let parser = Parser::new_ext(markdown, options);

    // State machine for building paragraphs
    let mut pending_runs: Vec<(String, bool, bool)> = Vec::new(); // (text, bold, italic)
    let mut current_text = String::new();
    let mut in_bold = false;
    let mut in_italic = false;
    let mut heading_level: Option<u8> = None;
    // Table state
    let mut in_table = false;
    let mut table_rows: Vec<Vec<String>> = Vec::new();
    let mut current_table_row: Vec<String> = Vec::new();
    let mut current_cell_text = String::new();

    // Helper: flush current runs into a Paragraph
    macro_rules! flush_paragraph {
        ($style:expr) => {{
            let mut para = Paragraph::new();
            if let Some(s) = $style {
                para = para.style(s);
            }
            // Flush any remaining text as a run
            if !current_text.is_empty() {
                pending_runs.push((current_text.clone(), in_bold, in_italic));
                current_text.clear();
            }
            for (text, bold, italic) in pending_runs.drain(..) {
                let mut run = Run::new().add_text(text);
                if bold { run = run.bold(); }
                if italic { run = run.italic(); }
                para = para.add_run(run);
            }
            docx = docx.add_paragraph(para);
        }};
    }

    for event in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                // Flush any pending paragraph first
                flush_paragraph!(None::<&str>);
                heading_level = Some(match level {
                    HeadingLevel::H1 => 1,
                    HeadingLevel::H2 => 2,
                    HeadingLevel::H3 => 3,
                    HeadingLevel::H4 => 4,
                    HeadingLevel::H5 => 5,
                    HeadingLevel::H6 => 6,
                });
            }
            Event::End(TagEnd::Heading(_)) => {
                let level = heading_level.unwrap_or(1);
                let style = format!("Heading{}", level);
                flush_paragraph!(Some(style.as_str()));
                heading_level = None;
            }
            Event::Start(Tag::Paragraph) => {}
            Event::End(TagEnd::Paragraph) => {
                flush_paragraph!(None::<&str>);
            }
            Event::Start(Tag::Strong) => {
                if !current_text.is_empty() {
                    pending_runs.push((current_text.clone(), in_bold, in_italic));
                    current_text.clear();
                }
                in_bold = true;
            }
            Event::End(TagEnd::Strong) => {
                if !current_text.is_empty() {
                    pending_runs.push((current_text.clone(), in_bold, in_italic));
                    current_text.clear();
                }
                in_bold = false;
            }
            Event::Start(Tag::Emphasis) => {
                if !current_text.is_empty() {
                    pending_runs.push((current_text.clone(), in_bold, in_italic));
                    current_text.clear();
                }
                in_italic = true;
            }
            Event::End(TagEnd::Emphasis) => {
                if !current_text.is_empty() {
                    pending_runs.push((current_text.clone(), in_bold, in_italic));
                    current_text.clear();
                }
                in_italic = false;
            }
            Event::Start(Tag::Table(_)) => {
                in_table = true;
                table_rows.clear();
            }
            Event::End(TagEnd::Table) => {
                in_table = false;
                // Build docx table
                if !table_rows.is_empty() {
                    let col_count = table_rows.iter().map(|r| r.len()).max().unwrap_or(0);
                    let mut docx_rows: Vec<TableRow> = Vec::new();
                    for row in &table_rows {
                        let mut docx_cells: Vec<TableCell> = Vec::new();
                        for i in 0..col_count {
                            let cell_text = row.get(i).map(|s| s.as_str()).unwrap_or("");
                            let para = Paragraph::new().add_run(Run::new().add_text(cell_text));
                            docx_cells.push(TableCell::new().add_paragraph(para));
                        }
                        docx_rows.push(TableRow::new(docx_cells));
                    }
                    let table = Table::new(docx_rows);
                    docx = docx.add_table(table);
                }
                table_rows.clear();
            }
            Event::Start(Tag::TableHead) => {
                current_table_row.clear();
            }
            Event::End(TagEnd::TableHead) => {
                // In pulldown-cmark 0.13+, header cells sit directly inside
                // TableHead with no TableRow wrapper — capture them now.
                table_rows.push(current_table_row.clone());
                current_table_row.clear();
            }
            Event::Start(Tag::TableRow) => {
                current_table_row.clear();
            }
            Event::End(TagEnd::TableRow) => {
                table_rows.push(current_table_row.clone());
                current_table_row.clear();
            }
            Event::Start(Tag::TableCell) => {
                current_cell_text.clear();
            }
            Event::End(TagEnd::TableCell) => {
                current_table_row.push(current_cell_text.clone());
                current_cell_text.clear();
            }
            Event::Text(text) => {
                if in_table {
                    current_cell_text.push_str(&text);
                } else {
                    current_text.push_str(&text);
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if !in_table {
                    current_text.push(' ');
                }
            }
            _ => {}
        }
    }

    // Flush any remaining content
    if !current_text.is_empty() || !pending_runs.is_empty() {
        flush_paragraph!(None::<&str>);
    }

    let file = File::create(path)
        .map_err(|e| ConversionError(format!("Failed to create file: {}", e)))?;
    let writer = BufWriter::new(file);
    docx.build()
        .pack(writer)
        .map_err(|e| ConversionError(format!("Failed to write DOCX: {:?}", e)))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_run_to_markdown_bold() {
        let run = Run::new().add_text("hello").bold();
        let result = run_to_markdown(&run);
        assert_eq!(result, "**hello**");
    }

    #[test]
    fn test_run_to_markdown_plain() {
        let run = Run::new().add_text("hello");
        let result = run_to_markdown(&run);
        assert_eq!(result, "hello");
    }
}
