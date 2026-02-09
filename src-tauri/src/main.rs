// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::VecDeque;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, State};

// State management
struct AppState {
    recent_files: Mutex<VecDeque<String>>,
    pending_open_files: Mutex<VecDeque<String>>,
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

// Drain any pending open-file requests (used on app startup).
#[tauri::command]
fn take_pending_open_files(state: State<AppState>) -> Result<Vec<String>, String> {
    let mut pending = state.pending_open_files
        .lock()
        .map_err(|_| "Failed to lock pending open files".to_string())?;
    Ok(pending.drain(..).collect())
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

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = collect_open_paths(argv);
            queue_open_files(app, paths);
        }))
        .manage(AppState {
            recent_files: Mutex::new(VecDeque::new()),
            pending_open_files: Mutex::new(VecDeque::new()),
        })
        .setup(|app| {
            let args = std::env::args().skip(1).collect::<Vec<_>>();
            let paths = collect_open_paths(args);
            queue_open_files(&app.handle(), paths);
            Ok(())
        })
        .menu(|handle| {
            // ... (rest of menu code remains the same)
            let menu = Menu::default(handle)?;
            let new_item = MenuItem::with_id(
                handle,
                "file_new",
                "New File",
                true,
                Some("CmdOrCtrl+N"),
            )?;
            let open_item = MenuItem::with_id(
                handle,
                "file_open",
                "Open...",
                true,
                Some("CmdOrCtrl+O"),
            )?;
            let save_item = MenuItem::with_id(
                handle,
                "file_save",
                "Save",
                true,
                Some("CmdOrCtrl+S"),
            )?;
            let save_as_item = MenuItem::with_id(
                handle,
                "file_save_as",
                "Save As...",
                true,
                Some("CmdOrCtrl+Shift+S"),
            )?;
            let close_document_item = MenuItem::with_id(
                handle,
                "file_close_document",
                "Close Document",
                true,
                Some("CmdOrCtrl+W"),
            )?;
            let file_separator = PredefinedMenuItem::separator(handle)?;

            let mut file_menu_found = false;
            for item in menu.items()? {
                if let Some(submenu) = item.as_submenu() {
                    if submenu.text()? == "File" {
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
                    "File",
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
                "Bold",
                true,
                Some("CmdOrCtrl+B"),
            )?;
            let italic_item = MenuItem::with_id(
                handle,
                "editor_italic",
                "Italic",
                true,
                Some("CmdOrCtrl+I"),
            )?;
            let strike_item = MenuItem::with_id(
                handle,
                "editor_strike",
                "Strikethrough",
                true,
                Some("CmdOrCtrl+Shift+X"),
            )?;
            let inline_code_item = MenuItem::with_id(
                handle,
                "editor_inline_code",
                "Inline Code",
                true,
                Some("CmdOrCtrl+Shift+C"),
            )?;
            let paragraph_item = MenuItem::with_id(
                handle,
                "editor_paragraph",
                "Paragraph",
                true,
                None::<&str>,
            )?;
            let heading_1_item = MenuItem::with_id(
                handle,
                "editor_heading_1",
                "Heading 1",
                true,
                Some("CmdOrCtrl+Option+1"),
            )?;
            let heading_2_item = MenuItem::with_id(
                handle,
                "editor_heading_2",
                "Heading 2",
                true,
                Some("CmdOrCtrl+Option+2"),
            )?;
            let heading_3_item = MenuItem::with_id(
                handle,
                "editor_heading_3",
                "Heading 3",
                true,
                Some("CmdOrCtrl+Option+3"),
            )?;
            let heading_4_item = MenuItem::with_id(
                handle,
                "editor_heading_4",
                "Heading 4",
                true,
                Some("CmdOrCtrl+Option+4"),
            )?;
            let heading_5_item = MenuItem::with_id(
                handle,
                "editor_heading_5",
                "Heading 5",
                true,
                Some("CmdOrCtrl+Option+5"),
            )?;
            let heading_6_item = MenuItem::with_id(
                handle,
                "editor_heading_6",
                "Heading 6",
                true,
                Some("CmdOrCtrl+Option+6"),
            )?;
            let bullet_list_item = MenuItem::with_id(
                handle,
                "editor_bullet_list",
                "Bullet List",
                true,
                Some("CmdOrCtrl+Shift+8"),
            )?;
            let ordered_list_item = MenuItem::with_id(
                handle,
                "editor_ordered_list",
                "Ordered List",
                true,
                Some("CmdOrCtrl+Shift+7"),
            )?;
            let blockquote_item = MenuItem::with_id(
                handle,
                "editor_blockquote",
                "Blockquote",
                true,
                None::<&str>,
            )?;
            let code_block_item = MenuItem::with_id(
                handle,
                "editor_code_block",
                "Code Block",
                true,
                None::<&str>,
            )?;
            let horizontal_rule_item = MenuItem::with_id(
                handle,
                "editor_horizontal_rule",
                "Horizontal Rule",
                true,
                None::<&str>,
            )?;

            let text_menu = Submenu::with_items(
                handle,
                "Text",
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
                "Headings",
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
                "Lists",
                true,
                &[&bullet_list_item, &ordered_list_item],
            )?;
            let block_menu = Submenu::with_items(
                handle,
                "Blocks",
                true,
                &[&blockquote_item, &code_block_item, &horizontal_rule_item],
            )?;
            let format_menu = Submenu::with_items(
                handle,
                "Format",
                true,
                &[&text_menu, &heading_menu, &list_menu, &block_menu],
            )?;
            menu.append(&format_menu)?;
            
            // Create theme submenu items
            let theme_github_light = MenuItem::with_id(
                handle,
                "view_theme_github_light",
                "GitHub Light",
                true,
                None::<&str>,
            )?;
            let theme_github_dark = MenuItem::with_id(
                handle,
                "view_theme_github_dark",
                "GitHub Dark",
                true,
                None::<&str>,
            )?;
            let theme_dracula = MenuItem::with_id(
                handle,
                "view_theme_dracula",
                "Dracula",
                true,
                None::<&str>,
            )?;
            let theme_nord_light = MenuItem::with_id(
                handle,
                "view_theme_nord_light",
                "Nord Light",
                true,
                None::<&str>,
            )?;
            let theme_nord_dark = MenuItem::with_id(
                handle,
                "view_theme_nord_dark",
                "Nord Dark",
                true,
                None::<&str>,
            )?;
            let theme_solarized_light = MenuItem::with_id(
                handle,
                "view_theme_solarized_light",
                "Solarized Light",
                true,
                None::<&str>,
            )?;
            let theme_solarized_dark = MenuItem::with_id(
                handle,
                "view_theme_solarized_dark",
                "Solarized Dark",
                true,
                None::<&str>,
            )?;
            
            let theme_menu = Submenu::with_items(
                handle,
                "Theme",
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
            
            let view_separator = PredefinedMenuItem::separator(handle)?;
            let mut view_menu_found = false;
            for item in menu.items()? {
                if let Some(submenu) = item.as_submenu() {
                    if submenu.text()? == "View" {
                        submenu.prepend_items(&[
                            &theme_menu,
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
                    "View",
                    true,
                    &[&theme_menu],
                )?;
                menu.append(&view_menu)?;
            }

            Ok(menu)
        })
        .on_menu_event(|app, event| {
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
            take_pending_open_files,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
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
