// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::VecDeque;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, State};

// State management
struct AppState {
    recent_files: Mutex<VecDeque<String>>,
    pending_open_files: Mutex<VecDeque<String>>,
    language: Mutex<String>,
}

impl AppState {
    fn new(language: String) -> Self {
        AppState {
            recent_files: Mutex::new(VecDeque::new()),
            pending_open_files: Mutex::new(VecDeque::new()),
            language: Mutex::new(language),
        }
    }
}

fn get_label(lang: &str, key: &str) -> String {
    match lang {
        "zh" => match key {
            "file" => "檔案".to_string(),
            "file_new" => "新檔案".to_string(),
            "file_open" => "開啟...".to_string(),
            "file_save" => "儲存".to_string(),
            "file_save_as" => "另存新檔...".to_string(),
            "file_close_document" => "關閉文件".to_string(),
            "format" => "格式".to_string(),
            "format_text" => "文字".to_string(),
            "format_bold" => "粗體".to_string(),
            "format_italic" => "斜體".to_string(),
            "format_strike" => "刪除線".to_string(),
            "format_inline_code" => "行內程式碼".to_string(),
            "format_headings" => "標題".to_string(),
            "format_paragraph" => "本文".to_string(),
            "format_heading_1" => "標題 1".to_string(),
            "format_heading_2" => "標題 2".to_string(),
            "format_heading_3" => "標題 3".to_string(),
            "format_heading_4" => "標題 4".to_string(),
            "format_heading_5" => "標題 5".to_string(),
            "format_heading_6" => "標題 6".to_string(),
            "format_lists" => "清單".to_string(),
            "format_bullet_list" => "項目符號清單".to_string(),
            "format_ordered_list" => "編號清單".to_string(),
            "format_blocks" => "區塊".to_string(),
            "format_blockquote" => "引用".to_string(),
            "format_code_block" => "程式碼區塊".to_string(),
            "format_horizontal_rule" => "水平分割線".to_string(),
            "view" => "檢視".to_string(),
            "view_source_code" => "原始碼".to_string(),
            "view_theme" => "佈景主題".to_string(),
            "view_language" => "語言".to_string(),
            "lang_en" => "English".to_string(),
            "lang_zh" => "繁體中文".to_string(),
            _ => key.to_string(),
        },
        _ => match key {
            "file" => "File".to_string(),
            "file_new" => "New File".to_string(),
            "file_open" => "Open...".to_string(),
            "file_save" => "Save".to_string(),
            "file_save_as" => "Save As...".to_string(),
            "file_close_document" => "Close Document".to_string(),
            "format" => "Format".to_string(),
            "format_text" => "Text".to_string(),
            "format_bold" => "Bold".to_string(),
            "format_italic" => "Italic".to_string(),
            "format_strike" => "Strikethrough".to_string(),
            "format_inline_code" => "Inline Code".to_string(),
            "format_headings" => "Headings".to_string(),
            "format_paragraph" => "Paragraph".to_string(),
            "format_heading_1" => "Heading 1".to_string(),
            "format_heading_2" => "Heading 2".to_string(),
            "format_heading_3" => "Heading 3".to_string(),
            "format_heading_4" => "Heading 4".to_string(),
            "format_heading_5" => "Heading 5".to_string(),
            "format_heading_6" => "Heading 6".to_string(),
            "format_lists" => "Lists".to_string(),
            "format_bullet_list" => "Bullet List".to_string(),
            "format_ordered_list" => "Ordered List".to_string(),
            "format_blocks" => "Blocks".to_string(),
            "format_blockquote" => "Blockquote".to_string(),
            "format_code_block" => "Code Block".to_string(),
            "format_horizontal_rule" => "Horizontal Rule".to_string(),
            "view" => "View".to_string(),
            "view_source_code" => "Source Code".to_string(),
            "view_theme" => "Theme".to_string(),
            "view_language" => "Language".to_string(),
            "lang_en" => "English".to_string(),
            "lang_zh" => "繁體中文".to_string(),
            _ => key.to_string(),
        },
    }
}

// File entry for directory listing
#[derive(Serialize, Deserialize, Clone)]
struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
}

// Read a markdown file
#[tauri::command]
async fn read_markdown_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// Save a markdown file
#[tauri::command]
async fn save_markdown_file(path: String, content: String) -> Result<(), String> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

// List directory contents
#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    let mut file_entries = Vec::new();
    
    for entry in entries {
        match entry {
            Ok(entry) => {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                
                // Skip hidden files
                if name.starts_with('.') {
                    continue;
                }
                
                let is_directory = path.is_dir();
                let path_str = path.to_string_lossy().to_string();
                
                file_entries.push(FileEntry {
                    name,
                    path: path_str,
                    is_directory,
                });
            }
            Err(_) => continue,
        }
    }
    
    // Sort: directories first, then files, both alphabetically
    file_entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(file_entries)
}

// Get recent files
#[tauri::command]
fn get_recent_files(state: State<AppState>) -> Result<Vec<String>, String> {
    let recent = state.recent_files.lock()
        .map_err(|_| "Failed to lock state".to_string())?;
    Ok(recent.iter().cloned().collect())
}

// Add a file to recent files
#[tauri::command]
fn add_recent_file(path: String, state: State<AppState>) -> Result<(), String> {
    let mut recent = state.recent_files.lock()
        .map_err(|_| "Failed to lock state".to_string())?;
    
    // Remove if already exists
    recent.retain(|p| p != &path);
    
    // Add to front
    recent.push_front(path);
    
    // Keep only 10 most recent
    recent.truncate(10);
    
    Ok(())
}

// Create a new file
#[tauri::command]
async fn create_file(path: String) -> Result<(), String> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Create empty file
    fs::write(&path, "")
        .map_err(|e| format!("Failed to create file: {}", e))
}

// Delete a file
#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file: {}", e))
}

// Rename a file
#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename file: {}", e))
}

// Check if file exists
#[tauri::command]
fn file_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

/**
 * Normalize language code to supported format ('en' or 'zh')
 */
fn normalize_language(lang: &str) -> String {
    match lang.to_lowercase().split('-').next().unwrap_or("en") {
        "zh" => "zh".to_string(),
        _ => "en".to_string(),
    }
}

/**
 * Get system locale using backend detection (Tauri v2 best practice)
 * Detects locale at Rust level for better performance and reliability
 */
#[tauri::command]
fn get_system_locale() -> Result<String, String> {
    match tauri_plugin_os::locale() {
        Some(locale_str) => {
            let normalized = normalize_language(&locale_str);
            println!("🌍 System locale detected: {} → normalized to: {}", 
                     locale_str, normalized);
            Ok(normalized)
        }
        None => {
            println!("⚠️ System locale not available, using default: English");
            Ok("en".to_string())
        }
    }
}

/**
 * Get the current language setting
 */
#[tauri::command]
fn get_language(state: State<AppState>) -> Result<String, String> {
    let lang = state.language.lock()
        .map_err(|_| "Failed to lock language state".to_string())?;
    Ok(lang.clone())
}

/**
 * Set language (typically called from frontend after user changes preference)
 * This updates the state but NOT the menu (menu is handled in event handler)
 */
#[tauri::command]
fn set_language(state: State<AppState>, lang: String) -> Result<(), String> {
    let normalized_lang = normalize_language(&lang);
    
    let mut l = state.language.lock()
        .map_err(|_| "Failed to lock language state".to_string())?;
    *l = normalized_lang.clone();
    
    println!("💾 Language state updated to: {}", normalized_lang);
    Ok(())
}

// Update check menu item state
#[tauri::command]
fn update_menu_item_state(app: AppHandle, id: String, checked: bool) -> Result<(), String> {
    if let Some(menu) = app.menu() {
        if let Some(item) = menu.get(&id) {
            if let Some(check_item) = item.as_check_menuitem() {
                let _ = check_item.set_checked(checked);
            }
        }
    }
    Ok(())
}

// Drain any pending open-file requests (used on app startup).
#[tauri::command]
fn take_pending_open_files(state: State<AppState>) -> Result<Vec<String>, String> {
    let mut pending = state.pending_open_files
        .lock()
        .map_err(|_| "Failed to lock pending open files".to_string())?;
    Ok(pending.drain(..).collect())
}

// Get OS platform (compile-time detection for early initialization)
#[tauri::command]
fn get_os_platform() -> String {
    #[cfg(target_os = "macos")]
    {
        "macos".to_string()
    }
    #[cfg(target_os = "windows")]
    {
        "windows".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "gnome".to_string()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        "unknown".to_string()
    }
}

#[derive(Serialize, Clone)]
struct MenuCommandPayload {
    command: String,
    level: Option<u8>,
}

fn emit_editor_command(app: &tauri::AppHandle, command: &str, level: Option<u8>) {
    let payload = MenuCommandPayload {
        command: command.to_string(),
        level,
    };
    let _ = app.emit("menu-editor-command", payload);
}

fn normalize_open_path(arg: &str) -> Option<String> {
    let trimmed = arg.trim_matches('"');
    if trimmed.is_empty() || trimmed.starts_with("-psn_") {
        return None;
    }

    let path_str = if let Ok(url) = tauri::Url::parse(trimmed) {
        if url.scheme() == "file" {
            url.to_file_path().ok()
        } else {
            None
        }
    } else {
        Some(PathBuf::from(trimmed))
    };

    let path = match path_str {
        Some(p) => p,
        None => return None,
    };

    if !path.is_file() {
        return None;
    }

    let ext = path.extension().and_then(|ext| ext.to_str()).unwrap_or("").to_lowercase();
    if ext != "md" && ext != "markdown" {
        return None;
    }

    Some(path.to_string_lossy().to_string())
}

fn collect_open_paths<I>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter()
        .filter_map(|arg| normalize_open_path(&arg))
        .collect()
}

fn queue_open_files(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<AppState>().pending_open_files.lock() {
        for path in &paths {
            if !pending.contains(path) {
                pending.push_back(path.clone());
            }
        }
    }

    for path in paths {
        let _ = app.emit("open-file", path);
    }
}

fn create_app_menu<R: tauri::Runtime>(handle: &AppHandle<R>, lang: &str) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(handle)?;
    
    let new_item = MenuItem::with_id(
        handle,
        "file_new",
        get_label(lang, "file_new"),
        true,
        Some("CmdOrCtrl+N"),
    )?;
    let open_item = MenuItem::with_id(
        handle,
        "file_open",
        get_label(lang, "file_open"),
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let save_item = MenuItem::with_id(
        handle,
        "file_save",
        get_label(lang, "file_save"),
        true,
        Some("CmdOrCtrl+S"),
    )?;
    let save_as_item = MenuItem::with_id(
        handle,
        "file_save_as",
        get_label(lang, "file_save_as"),
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let close_document_item = MenuItem::with_id(
        handle,
        "file_close_document",
        get_label(lang, "file_close_document"),
        true,
        Some("CmdOrCtrl+W"),
    )?;
    let file_separator = PredefinedMenuItem::separator(handle)?;

    let mut file_menu_found = false;
    for item in menu.items()? {
        if let Some(submenu) = item.as_submenu() {
            if submenu.text()? == "File" || submenu.text()? == "檔案" {
                submenu.set_text(get_label(lang, "file"))?;
                submenu.prepend_items(&[
                    &new_item,
                    &open_item,
                    &save_item,
                    &save_as_item,
                    &close_document_item,
                    &file_separator,
                ])?;
                file_menu_found = true;
                break;
            }
        }
    }

    if !file_menu_found {
        let file_menu = Submenu::with_items(
            handle,
            get_label(lang, "file"),
            true,
            &[
                &new_item,
                &open_item,
                &file_separator,
                &save_item,
                &save_as_item,
                &close_document_item,
                &PredefinedMenuItem::close_window(handle, Some("CmdOrCtrl+Shift+W"))?,
            ],
        )?;
        menu.append(&file_menu)?;
    }

    let bold_item = MenuItem::with_id(
        handle,
        "editor_bold",
        get_label(lang, "format_bold"),
        true,
        Some("CmdOrCtrl+B"),
    )?;
    let italic_item = MenuItem::with_id(
        handle,
        "editor_italic",
        get_label(lang, "format_italic"),
        true,
        Some("CmdOrCtrl+I"),
    )?;
    let strike_item = MenuItem::with_id(
        handle,
        "editor_strike",
        get_label(lang, "format_strike"),
        true,
        Some("CmdOrCtrl+Shift+X"),
    )?;
    let inline_code_item = MenuItem::with_id(
        handle,
        "editor_inline_code",
        get_label(lang, "format_inline_code"),
        true,
        Some("CmdOrCtrl+Shift+C"),
    )?;
    let paragraph_item = MenuItem::with_id(
        handle,
        "editor_paragraph",
        get_label(lang, "format_paragraph"),
        true,
        None::<&str>,
    )?;
    let heading_1_item = MenuItem::with_id(
        handle,
        "editor_heading_1",
        get_label(lang, "format_heading_1"),
        true,
        Some("CmdOrCtrl+Option+1"),
    )?;
    let heading_2_item = MenuItem::with_id(
        handle,
        "editor_heading_2",
        get_label(lang, "format_heading_2"),
        true,
        Some("CmdOrCtrl+Option+2"),
    )?;
    let heading_3_item = MenuItem::with_id(
        handle,
        "editor_heading_3",
        get_label(lang, "format_heading_3"),
        true,
        Some("CmdOrCtrl+Option+3"),
    )?;
    let heading_4_item = MenuItem::with_id(
        handle,
        "editor_heading_4",
        get_label(lang, "format_heading_4"),
        true,
        Some("CmdOrCtrl+Option+4"),
    )?;
    let heading_5_item = MenuItem::with_id(
        handle,
        "editor_heading_5",
        get_label(lang, "format_heading_5"),
        true,
        Some("CmdOrCtrl+Option+5"),
    )?;
    let heading_6_item = MenuItem::with_id(
        handle,
        "editor_heading_6",
        get_label(lang, "format_heading_6"),
        true,
        Some("CmdOrCtrl+Option+6"),
    )?;
    let bullet_list_item = MenuItem::with_id(
        handle,
        "editor_bullet_list",
        get_label(lang, "format_bullet_list"),
        true,
        Some("CmdOrCtrl+Shift+8"),
    )?;
    let ordered_list_item = MenuItem::with_id(
        handle,
        "editor_ordered_list",
        get_label(lang, "format_ordered_list"),
        true,
        Some("CmdOrCtrl+Shift+7"),
    )?;
    let blockquote_item = MenuItem::with_id(
        handle,
        "editor_blockquote",
        get_label(lang, "format_blockquote"),
        true,
        None::<&str>,
    )?;
    let code_block_item = MenuItem::with_id(
        handle,
        "editor_code_block",
        get_label(lang, "format_code_block"),
        true,
        None::<&str>,
    )?;
    let horizontal_rule_item = MenuItem::with_id(
        handle,
        "editor_horizontal_rule",
        get_label(lang, "format_horizontal_rule"),
        true,
        None::<&str>,
    )?;

    let text_menu = Submenu::with_items(
        handle,
        get_label(lang, "format_text"),
        true,
        &[
            &bold_item,
            &italic_item,
            &strike_item,
            &inline_code_item,
        ],
    )?;
    let heading_menu = Submenu::with_items(
        handle,
        get_label(lang, "format_headings"),
        true,
        &[
            &paragraph_item,
            &heading_1_item,
            &heading_2_item,
            &heading_3_item,
            &heading_4_item,
            &heading_5_item,
            &heading_6_item,
        ],
    )?;
    let list_menu = Submenu::with_items(
        handle,
        get_label(lang, "format_lists"),
        true,
        &[&bullet_list_item, &ordered_list_item],
    )?;
    let block_menu = Submenu::with_items(
        handle,
        get_label(lang, "format_blocks"),
        true,
        &[&blockquote_item, &code_block_item, &horizontal_rule_item],
    )?;
    let format_menu = Submenu::with_items(
        handle,
        get_label(lang, "format"),
        true,
        &[&text_menu, &heading_menu, &list_menu, &block_menu],
    )?;
    menu.append(&format_menu)?;
    
    // Create theme submenu items
    let theme_github_light = MenuItem::with_id(handle, "view_theme_github_light", "GitHub Light", true, None::<&str>)?;
    let theme_github_dark = MenuItem::with_id(handle, "view_theme_github_dark", "GitHub Dark", true, None::<&str>)?;
    let theme_dracula = MenuItem::with_id(handle, "view_theme_dracula", "Dracula", true, None::<&str>)?;
    let theme_nord_light = MenuItem::with_id(handle, "view_theme_nord_light", "Nord Light", true, None::<&str>)?;
    let theme_nord_dark = MenuItem::with_id(handle, "view_theme_nord_dark", "Nord Dark", true, None::<&str>)?;
    let theme_solarized_light = MenuItem::with_id(handle, "view_theme_solarized_light", "Solarized Light", true, None::<&str>)?;
    let theme_solarized_dark = MenuItem::with_id(handle, "view_theme_solarized_dark", "Solarized Dark", true, None::<&str>)?;
    
    let theme_menu = Submenu::with_items(
        handle,
        get_label(lang, "view_theme"),
        true,
        &[
            &theme_github_light,
            &theme_github_dark,
            &theme_dracula,
            &theme_nord_light,
            &theme_nord_dark,
            &theme_solarized_light,
            &theme_solarized_dark,
        ],
    )?;

    // Create language submenu
    let lang_en_item = CheckMenuItem::with_id(
        handle,
        "lang_en",
        get_label(lang, "lang_en"),
        true,
        lang == "en",
        None::<&str>,
    )?;
    let lang_zh_item = CheckMenuItem::with_id(
        handle,
        "lang_zh",
        get_label(lang, "lang_zh"),
        true,
        lang == "zh",
        None::<&str>,
    )?;
    
    let language_menu = Submenu::with_items(
        handle,
        get_label(lang, "view_language"),
        true,
        &[&lang_en_item, &lang_zh_item],
    )?;

    let source_code_item = CheckMenuItem::with_id(
        handle,
        "view_source_code",
        get_label(lang, "view_source_code"),
        true,
        false,
        Some("CmdOrCtrl+Alt+S"),
    )?;
    
    let view_separator = PredefinedMenuItem::separator(handle)?;
    let mut view_menu_found = false;
    for item in menu.items()? {
        if let Some(submenu) = item.as_submenu() {
            if submenu.text()? == "View" || submenu.text()? == "檢視" {
                submenu.set_text(get_label(lang, "view"))?;
                submenu.prepend_items(&[
                    &source_code_item,
                    &view_separator,
                    &theme_menu,
                    &language_menu,
                    &view_separator,
                ])?;
                view_menu_found = true;
                break;
            }
        }
    }
    if !view_menu_found {
        let view_menu = Submenu::with_items(
            handle,
            get_label(lang, "view"),
            true,
            &[
                &source_code_item,
                &view_separator,
                &theme_menu,
                &language_menu,
            ],
        )?;
        menu.append(&view_menu)?;
    }

    Ok(menu)
}

fn main() {
    // Initialize default language (will be overridden by frontend once it loads settings)
    let default_language = "en".to_string();
    
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = collect_open_paths(argv);
            queue_open_files(app, paths);
        }))
        .manage(AppState::new(default_language.clone()))
        .setup(|app| {
            let args = std::env::args().skip(1).collect::<Vec<_>>();
            let paths = collect_open_paths(args);
            queue_open_files(&app.handle(), paths);
            Ok(())
        })
        .menu(move |handle| {
            // Menu starts with default language, will be updated when frontend loads
            create_app_menu(handle, &default_language)
        })
        .on_menu_event(|app, event| {
            // ... (rest of menu event handler remains the same)
            if event.id() == "file_new" {
                let _ = app.emit("menu-new-file", ());
            } else if event.id() == "file_open" {
                let _ = app.emit("menu-open-file", ());
            } else if event.id() == "file_save" {
                let _ = app.emit("menu-save-file", ());
            } else if event.id() == "file_save_as" {
                let _ = app.emit("menu-save-as", ());
            } else if event.id() == "file_close_document" {
                let _ = app.emit("menu-close-document", ());
            } else if event.id() == "view_source_code" {
                let _ = app.emit("menu-toggle-editor-mode", ());
            } else if event.id() == "view_theme_github_light" {
                let _ = app.emit("menu-set-theme", "github-light");
            } else if event.id() == "view_theme_github_dark" {
                let _ = app.emit("menu-set-theme", "github-dark");
            } else if event.id() == "view_theme_dracula" {
                let _ = app.emit("menu-set-theme", "dracula");
            } else if event.id() == "view_theme_nord_light" {
                let _ = app.emit("menu-set-theme", "nord-light");
            } else if event.id() == "view_theme_nord_dark" {
                let _ = app.emit("menu-set-theme", "nord-dark");
            } else if event.id() == "view_theme_solarized_light" {
                let _ = app.emit("menu-set-theme", "solarized-light");
            } else if event.id() == "view_theme_solarized_dark" {
                let _ = app.emit("menu-set-theme", "solarized-dark");
            } else if event.id() == "lang_en" {
                println!("🌐 User selected: English");
                // Update menu directly
                if let Ok(menu) = create_app_menu(&app, "en") {
                    let _ = app.set_menu(menu);
                }
                // Update backend state
                if let Ok(mut lang) = app.state::<AppState>().language.lock() {
                    *lang = "en".to_string();
                }
                // Notify frontend about the language change
                let _ = app.emit("language-changed", "en");
                println!("✅ Language changed to: English");
            } else if event.id() == "lang_zh" {
                println!("🌐 User selected: Chinese");
                // Update menu directly
                if let Ok(menu) = create_app_menu(&app, "zh") {
                    let _ = app.set_menu(menu);
                }
                // Update backend state
                if let Ok(mut lang) = app.state::<AppState>().language.lock() {
                    *lang = "zh".to_string();
                }
                // Notify frontend about the language change
                let _ = app.emit("language-changed", "zh");
                println!("✅ Language changed to: Chinese");
            } else if event.id() == "editor_bold" {
                emit_editor_command(app, "bold", None);
            } else if event.id() == "editor_italic" {
                emit_editor_command(app, "italic", None);
            } else if event.id() == "editor_strike" {
                emit_editor_command(app, "strike", None);
            } else if event.id() == "editor_inline_code" {
                emit_editor_command(app, "inline_code", None);
            } else if event.id() == "editor_paragraph" {
                emit_editor_command(app, "paragraph", None);
            } else if event.id() == "editor_heading_1" {
                emit_editor_command(app, "heading", Some(1));
            } else if event.id() == "editor_heading_2" {
                emit_editor_command(app, "heading", Some(2));
            } else if event.id() == "editor_heading_3" {
                emit_editor_command(app, "heading", Some(3));
            } else if event.id() == "editor_heading_4" {
                emit_editor_command(app, "heading", Some(4));
            } else if event.id() == "editor_heading_5" {
                emit_editor_command(app, "heading", Some(5));
            } else if event.id() == "editor_heading_6" {
                emit_editor_command(app, "heading", Some(6));
            } else if event.id() == "editor_bullet_list" {
                emit_editor_command(app, "bullet_list", None);
            } else if event.id() == "editor_ordered_list" {
                emit_editor_command(app, "ordered_list", None);
            } else if event.id() == "editor_blockquote" {
                emit_editor_command(app, "blockquote", None);
            } else if event.id() == "editor_code_block" {
                emit_editor_command(app, "code_block", None);
            } else if event.id() == "editor_horizontal_rule" {
                emit_editor_command(app, "horizontal_rule", None);
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_markdown_file,
            save_markdown_file,
            list_directory,
            get_recent_files,
            add_recent_file,
            create_file,
            delete_file,
            rename_file,
            file_exists,
            update_menu_item_state,
            take_pending_open_files,
            get_os_platform,
            get_system_locale,
            get_language,
            set_language,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Ready = event {
            // Emit platform info as soon as the app is ready
            let platform = if cfg!(target_os = "macos") {
                "macos"
            } else if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "linux") {
                "gnome"
            } else {
                "unknown"
            };
            let _ = app_handle.emit("init-platform", platform);
        }

        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths: Vec<String> = urls
                .into_iter()
                .filter_map(|url| {
                    if url.scheme() == "file" {
                        url.to_file_path()
                            .ok()
                            .map(|p| p.to_string_lossy().to_string())
                    } else {
                        None
                    }
                })
                .collect();
            queue_open_files(app_handle, paths);
        }
    });
}
