// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::VecDeque;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, State};

// State management
struct AppState {
    recent_files: Mutex<VecDeque<String>>,
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            recent_files: Mutex::new(VecDeque::new()),
        })
        .menu(|handle| {
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
            let separator = PredefinedMenuItem::separator(handle)?;

            let mut file_menu_found = false;
            for item in menu.items()? {
                if let Some(submenu) = item.as_submenu() {
                    if submenu.text()? == "File" {
                        submenu.prepend_items(&[&new_item, &open_item, &separator])?;
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
                        &separator,
                        &PredefinedMenuItem::close_window(handle, None)?,
                    ],
                )?;
                menu.append(&file_menu)?;
            }

            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id() == "file_new" {
                let _ = app.emit("menu-new-file", ());
            } else if event.id() == "file_open" {
                let _ = app.emit("menu-open-file", ());
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
