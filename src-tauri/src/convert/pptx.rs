use super::ConversionError;

/// Convert a PPTX file to Markdown.
/// Each slide's text content becomes a section.
pub fn pptx_to_markdown(path: &str) -> Result<String, ConversionError> {
    // Parse PPTX as a ZIP archive and extract text from slide XML
    let file = std::fs::File::open(path)
        .map_err(|e| ConversionError(format!("Failed to open PPTX: {}", e)))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| ConversionError(format!("Failed to read PPTX archive: {}", e)))?;

    let mut slides: Vec<(usize, String)> = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| ConversionError(format!("Failed to read archive entry: {}", e)))?;

        let name = entry.name().to_string();
        // Slide XML files are at ppt/slides/slide{N}.xml
        if !name.starts_with("ppt/slides/slide") || !name.ends_with(".xml") {
            continue;
        }

        // Extract slide number from filename
        let slide_num: usize = name
            .trim_start_matches("ppt/slides/slide")
            .trim_end_matches(".xml")
            .parse()
            .unwrap_or(0);

        let mut content = String::new();
        use std::io::Read;
        entry
            .read_to_string(&mut content)
            .map_err(|e| ConversionError(format!("Failed to read slide XML: {}", e)))?;

        let text = extract_text_from_slide_xml(&content);
        if !text.is_empty() {
            slides.push((slide_num, text));
        }
    }

    // Sort slides by number
    slides.sort_by_key(|(n, _)| *n);

    let mut output = String::new();
    for (i, (_, text)) in slides.iter().enumerate() {
        if i > 0 {
            output.push('\n');
        }
        output.push_str(text);
        output.push('\n');
    }

    Ok(output)
}

/// Extract plain text from PPTX slide XML.
/// Looks for <a:t> tags which contain the actual text content.
fn extract_text_from_slide_xml(xml: &str) -> String {
    let mut output = String::new();
    let mut first_para = true;

    // Simple XML text extraction: find <a:t>...</a:t> within <a:p> blocks
    for para in xml.split("<a:p>") {
        let mut para_text = String::new();
        for part in para.split("<a:t>") {
            if let Some(end) = part.find("</a:t>") {
                let text = &part[..end];
                // Decode basic XML entities
                let decoded = text
                    .replace("&amp;", "&")
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&quot;", "\"")
                    .replace("&apos;", "'");
                para_text.push_str(&decoded);
            }
        }
        let trimmed = para_text.trim().to_string();
        if !trimmed.is_empty() {
            if first_para {
                // First non-empty paragraph becomes a heading
                output.push_str(&format!("# {}\n", trimmed));
                first_para = false;
            } else {
                output.push_str(&format!("\n{}", trimmed));
            }
        }
    }

    output
}

/// Convert Markdown to a PPTX file.
/// `# Heading` boundaries define slide splits.
/// Each heading starts a new slide; remaining content goes in the slide body.
pub fn markdown_to_pptx(markdown: &str, path: &str) -> Result<(), ConversionError> {
    // Parse slides from markdown: split on H1 headings
    let mut slides: Vec<(String, Vec<String>)> = Vec::new();
    let mut current_title = String::new();
    let mut current_body: Vec<String> = Vec::new();

    for line in markdown.lines() {
        if line.starts_with("# ") && !line.starts_with("## ") {
            // New slide
            if !current_title.is_empty() || !current_body.is_empty() {
                slides.push((current_title.clone(), current_body.clone()));
            }
            current_title = line.trim_start_matches("# ").to_string();
            current_body.clear();
        } else if !line.trim().is_empty() {
            current_body.push(line.to_string());
        }
    }
    // Last slide
    if !current_title.is_empty() || !current_body.is_empty() {
        slides.push((current_title, current_body));
    }

    if slides.is_empty() {
        // Create a single slide with the entire content as body
        slides.push(("Presentation".to_string(),
                      markdown.lines().map(|l| l.to_string()).collect()));
    }

    build_pptx(slides, path)
}

/// Build a minimal PPTX file from slide data.
/// PPTX is a ZIP file with specific XML structure.
fn build_pptx(slides: Vec<(String, Vec<String>)>, path: &str) -> Result<(), ConversionError> {
    use std::io::Write;

    let file = std::fs::File::create(path)
        .map_err(|e| ConversionError(format!("Failed to create PPTX file: {}", e)))?;

    let mut zip = zip::ZipWriter::new(file);

    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // [Content_Types].xml
    zip.start_file("[Content_Types].xml", options)
        .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
    let mut content_types = String::from(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
"#,
    );
    for i in 0..slides.len() {
        content_types.push_str(&format!(
            r#"  <Override PartName="/ppt/slides/slide{}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
"#,
            i + 1
        ));
    }
    content_types.push_str("</Types>");
    zip.write_all(content_types.as_bytes())
        .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

    // _rels/.rels
    zip.start_file("_rels/.rels", options)
        .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
    zip.write_all(
        br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"#,
    )
    .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

    // ppt/_rels/presentation.xml.rels
    zip.start_file("ppt/_rels/presentation.xml.rels", options)
        .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
    let mut pres_rels = String::from(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
"#,
    );
    for i in 0..slides.len() {
        pres_rels.push_str(&format!(
            r#"  <Relationship Id="rId{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{}.xml"/>
"#,
            i + 2,
            i + 1
        ));
    }
    pres_rels.push_str("</Relationships>");
    zip.write_all(pres_rels.as_bytes())
        .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

    // ppt/presentation.xml
    zip.start_file("ppt/presentation.xml", options)
        .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
    let mut slide_list = String::new();
    for i in 0..slides.len() {
        slide_list.push_str(&format!(
            r#"    <p:sldId id="{}" r:id="rId{}"/>
"#,
            256 + i,
            i + 2
        ));
    }
    let pres_xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
{}  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>"#,
        slide_list
    );
    zip.write_all(pres_xml.as_bytes())
        .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

    // Minimal slide master
    zip.start_file("ppt/slideMasters/slideMaster1.xml", options)
        .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
    zip.write_all(
        br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>"#,
    )
    .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

    zip.start_file("ppt/slideMasters/_rels/slideMaster1.xml.rels", options)
        .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
    zip.write_all(
        br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>"#,
    )
    .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

    // Minimal slide layout
    zip.start_file("ppt/slideLayouts/slideLayout1.xml", options)
        .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
    zip.write_all(
        br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>"#,
    )
    .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

    zip.start_file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", options)
        .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
    zip.write_all(
        br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>"#,
    )
    .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

    // Individual slides
    for (i, (title, body_lines)) in slides.iter().enumerate() {
        let slide_path = format!("ppt/slides/slide{}.xml", i + 1);
        let rels_path = format!("ppt/slides/_rels/slide{}.xml.rels", i + 1);

        // Slide rels
        zip.start_file(&rels_path, options)
            .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
        zip.write_all(
            br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>"#,
        )
        .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;

        // Slide XML
        let title_escaped = xml_escape(title);
        let body_text = body_lines.join("\n");
        let body_escaped = xml_escape(&body_text);

        let slide_xml = format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>{}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4525963"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>{}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>"#,
            title_escaped, body_escaped
        );

        zip.start_file(&slide_path, options)
            .map_err(|e| ConversionError(format!("ZIP error: {}", e)))?;
        zip.write_all(slide_xml.as_bytes())
            .map_err(|e| ConversionError(format!("ZIP write error: {}", e)))?;
    }

    zip.finish()
        .map_err(|e| ConversionError(format!("Failed to finalize PPTX: {}", e)))?;

    Ok(())
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
