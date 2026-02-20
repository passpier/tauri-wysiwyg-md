use calamine::{open_workbook_auto, Data, Reader};
use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
use rust_xlsxwriter::Workbook;

use super::ConversionError;

const MAX_ROWS_PER_SHEET: usize = 500;

/// Convert an Excel file (xlsx/xls/ods/csv) to Markdown.
/// Each sheet becomes a ## heading followed by a GFM table.
/// Rows are capped at MAX_ROWS_PER_SHEET with an inline note if truncated.
pub fn xlsx_to_markdown(path: &str) -> Result<String, ConversionError> {
    let mut workbook = open_workbook_auto(path)
        .map_err(|e| ConversionError(format!("Failed to open spreadsheet: {}", e)))?;

    let sheet_names: Vec<String> = workbook.sheet_names().to_vec();
    let mut output = String::new();

    for sheet_name in sheet_names {
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| ConversionError(format!("Failed to read sheet '{}': {}", sheet_name, e)))?;

        let (total_rows, col_count) = range.get_size();

        if col_count == 0 {
            continue;
        }

        if !output.is_empty() {
            output.push('\n');
        }
        output.push_str(&format!("## {}\n\n", sheet_name));

        if total_rows == 0 {
            output.push_str("*(empty sheet)*\n");
            continue;
        }

        let rows_to_read = total_rows.min(MAX_ROWS_PER_SHEET + 1); // +1 for header
        let mut rows_iter = range.rows().take(rows_to_read);

        // Header row
        let header = match rows_iter.next() {
            Some(row) => row,
            None => continue,
        };

        output.push('|');
        for cell in header {
            output.push_str(&format!(" {} |", cell_to_string(cell)));
        }
        output.push('\n');

        // Separator
        output.push('|');
        for _ in 0..col_count {
            output.push_str(" --- |");
        }
        output.push('\n');

        // Data rows
        let mut data_row_count = 0usize;
        for row in rows_iter {
            if data_row_count >= MAX_ROWS_PER_SHEET {
                break;
            }
            output.push('|');
            for cell in row {
                output.push_str(&format!(" {} |", cell_to_string(cell)));
            }
            output.push('\n');
            data_row_count += 1;
        }

        // Truncation notice
        if total_rows > MAX_ROWS_PER_SHEET + 1 {
            let omitted = total_rows - MAX_ROWS_PER_SHEET - 1;
            output.push_str(&format!(
                "\n> **Note**: {} rows were omitted (showing first {} data rows).\n",
                omitted, MAX_ROWS_PER_SHEET
            ));
        }
    }

    Ok(output)
}

pub fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(s) => s.clone(),
        Data::Float(f) => {
            if f.fract() == 0.0 && f.abs() < 1e15 {
                format!("{}", *f as i64)
            } else {
                format!("{}", f)
            }
        }
        Data::Int(i) => format!("{}", i),
        Data::Bool(b) => if *b { "TRUE".to_string() } else { "FALSE".to_string() },
        Data::Error(e) => format!("{:?}", e),
        Data::DateTime(dt) => format!("{}", dt),
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
    }
}

/// Extract GFM pipe tables from Markdown text.
/// Returns a list of (header_row, data_rows) where each row is Vec<String>.
pub fn extract_tables_from_markdown(markdown: &str) -> Vec<(Vec<String>, Vec<Vec<String>>)> {
    let mut tables = Vec::new();
    let options = Options::ENABLE_TABLES;
    let parser = Parser::new_ext(markdown, options);

    let mut in_table = false;
    let mut in_table_head = false;
    let mut header_row: Vec<String> = Vec::new();
    let mut data_rows: Vec<Vec<String>> = Vec::new();
    let mut current_row: Vec<String> = Vec::new();
    let mut current_cell = String::new();

    for event in parser {
        match event {
            Event::Start(Tag::Table(_)) => {
                in_table = true;
                header_row.clear();
                data_rows.clear();
            }
            Event::End(TagEnd::Table) => {
                in_table = false;
                tables.push((header_row.clone(), data_rows.clone()));
                header_row.clear();
                data_rows.clear();
            }
            Event::Start(Tag::TableHead) => {
                in_table_head = true;
                current_row.clear();
            }
            Event::End(TagEnd::TableHead) => {
                // In pulldown-cmark 0.13+, header cells sit directly inside
                // TableHead with no TableRow wrapper — save them now.
                in_table_head = false;
                header_row = current_row.clone();
                current_row.clear();
            }
            Event::Start(Tag::TableRow) => {
                current_row.clear();
            }
            Event::End(TagEnd::TableRow) => {
                // Only data rows have TableRow wrappers
                data_rows.push(current_row.clone());
                current_row.clear();
            }
            Event::Start(Tag::TableCell) => {
                current_cell.clear();
            }
            Event::End(TagEnd::TableCell) => {
                current_row.push(current_cell.clone());
                current_cell.clear();
            }
            Event::Text(text) if in_table => {
                current_cell.push_str(&text);
            }
            _ => {}
        }
    }

    let _ = in_table_head;
    tables
}

/// Convert Markdown to an XLSX file.
/// GFM tables in the Markdown become worksheets.
/// If no tables are found, writes all lines as plain text to Sheet1.
pub fn markdown_to_xlsx(markdown: &str, path: &str) -> Result<(), ConversionError> {
    let mut workbook = Workbook::new();
    let tables = extract_tables_from_markdown(markdown);

    if tables.is_empty() {
        // Fall back: write plain text lines to Sheet1
        let sheet = workbook
            .add_worksheet()
            .set_name("Sheet1")
            .map_err(|e| ConversionError(format!("Failed to create sheet: {}", e)))?;

        for (row_idx, line) in markdown.lines().enumerate() {
            sheet
                .write_string(row_idx as u32, 0, line)
                .map_err(|e| ConversionError(format!("Failed to write cell: {}", e)))?;
        }
    } else {
        for (table_idx, (header, data_rows)) in tables.iter().enumerate() {
            let sheet_name = format!("Table{}", table_idx + 1);
            let sheet = workbook
                .add_worksheet()
                .set_name(&sheet_name)
                .map_err(|e| ConversionError(format!("Failed to create sheet: {}", e)))?;

            // Write header
            for (col_idx, cell) in header.iter().enumerate() {
                sheet
                    .write_string(0, col_idx as u16, cell)
                    .map_err(|e| ConversionError(format!("Failed to write header: {}", e)))?;
            }

            // Write data rows
            for (row_idx, row) in data_rows.iter().enumerate() {
                for (col_idx, cell) in row.iter().enumerate() {
                    sheet
                        .write_string((row_idx + 1) as u32, col_idx as u16, cell)
                        .map_err(|e| ConversionError(format!("Failed to write data: {}", e)))?;
                }
            }
        }
    }

    workbook
        .save(path)
        .map_err(|e| ConversionError(format!("Failed to save workbook: {}", e)))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_to_string_float() {
        assert_eq!(cell_to_string(&Data::Float(42.0)), "42");
        assert_eq!(cell_to_string(&Data::Float(3.14)), "3.14");
    }

    #[test]
    fn test_cell_to_string_bool() {
        assert_eq!(cell_to_string(&Data::Bool(true)), "TRUE");
        assert_eq!(cell_to_string(&Data::Bool(false)), "FALSE");
    }

    #[test]
    fn test_extract_tables_from_markdown() {
        let md = "| Col1 | Col2 |\n| --- | --- |\n| A | B |\n| C | D |\n";
        let tables = extract_tables_from_markdown(md);
        assert_eq!(tables.len(), 1);
        let (header, data) = &tables[0];
        assert_eq!(header, &["Col1", "Col2"]);
        assert_eq!(data.len(), 2);
        assert_eq!(data[0], &["A", "B"]);
    }

    #[test]
    fn test_extract_tables_no_tables() {
        let md = "# Heading\n\nJust a paragraph.\n";
        let tables = extract_tables_from_markdown(md);
        assert!(tables.is_empty());
    }
}
