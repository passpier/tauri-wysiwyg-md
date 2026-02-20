use markdown2pdf::config::ConfigSource;

use super::ConversionError;

const PDF_IMPORT_NOTICE: &str = "> **Import Notice**: This PDF was imported as plain text.\n\
> Images, tables, and complex formatting have been removed.\n\n";

/// Convert Markdown to a PDF file.
pub fn markdown_to_pdf(markdown: &str, path: &str) -> Result<(), ConversionError> {
    markdown2pdf::parse_into_file(markdown.to_string(), path, ConfigSource::Default, None)
        .map_err(|e| ConversionError(format!("PDF export failed: {}", e)))
}

/// Convert a PDF file to Markdown (plain text extraction).
/// Prepends a blockquote warning about quality limitations.
pub fn pdf_to_markdown(path: &str) -> Result<String, ConversionError> {
    let bytes = std::fs::read(path)
        .map_err(|e| ConversionError(format!("Failed to read PDF: {}", e)))?;

    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| ConversionError(format!("Failed to extract PDF text: {}", e)))?;

    let mut output = String::from(PDF_IMPORT_NOTICE);
    output.push_str(&text);

    Ok(output)
}
