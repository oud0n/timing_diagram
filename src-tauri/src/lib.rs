mod files;
use std::{collections::HashSet, path::PathBuf, sync::Mutex};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};
use tauri_plugin_dialog::DialogExt;
struct Startup {
    started: std::time::Instant,
    reported: std::sync::atomic::AtomicBool,
}
#[derive(Default)]
struct FileAccess(Mutex<HashSet<PathBuf>>);
#[derive(serde::Serialize)]
struct OpenedDocument {
    path: String,
    content: String,
}
fn grant(app: &tauri::AppHandle, path: PathBuf) -> Result<(), String> {
    app.state::<FileAccess>()
        .0
        .lock()
        .map_err(|_| "File access lock unavailable")?
        .insert(path);
    Ok(())
}
#[tauri::command]
async fn open_document(app: tauri::AppHandle) -> Result<Option<OpenedDocument>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("Timing diagram", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file.into_path().map_err(|e| e.to_string())?;
        let content = files::read_text(&path)?;
        grant(&app, path.clone())?;
        Ok(Some(OpenedDocument {
            path: path.to_string_lossy().into(),
            content,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn save_document(
    app: tauri::AppHandle,
    path: Option<String>,
    content: String,
    kind: String,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let extension = match kind.as_str() {
            "json" => "json",
            "svg" => "svg",
            _ => return Err("Unsupported file type".into()),
        };
        let destination = if let Some(path) = path {
            let candidate = PathBuf::from(path);
            if !app
                .state::<FileAccess>()
                .0
                .lock()
                .map_err(|_| "File access lock unavailable")?
                .contains(&candidate)
            {
                return Err("Choose this file through the save dialog first".into());
            }
            candidate
        } else {
            let Some(file) = app
                .dialog()
                .file()
                .add_filter("Timing diagram", &[extension])
                .set_file_name(format!("timing_diagram.{extension}"))
                .blocking_save_file()
            else {
                return Ok(None);
            };
            let mut destination = file.into_path().map_err(|e| e.to_string())?;
            if destination.extension().is_none() {
                destination.set_extension(extension);
            }
            destination
        };
        files::atomic_write(&destination, &content)?;
        grant(&app, destination.clone())?;
        Ok(Some(destination.to_string_lossy().into()))
    })
    .await
    .map_err(|e| e.to_string())?
}
/// The window starts hidden so the webview's default white page never shows before the theme is applied.
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
#[tauri::command]
fn frontend_ready(app: tauri::AppHandle, startup: tauri::State<Startup>) {
    show_main_window(&app);
    if !startup
        .reported
        .swap(true, std::sync::atomic::Ordering::Relaxed)
    {
        eprintln!(
            "Tickwave ready in {} ms",
            startup.started.elapsed().as_millis()
        );
    }
}
#[tauri::command]
fn exit_editor(app: tauri::AppHandle) {
    app.exit(0);
}
fn install_menu(app: &mut tauri::App) -> tauri::Result<()> {
    let item = |id, text, shortcut| MenuItem::with_id(app, id, text, true, Some(shortcut));
    let new = item("new", "New", "CmdOrCtrl+N")?;
    let open = item("open", "Open…", "CmdOrCtrl+O")?;
    let save = item("save", "Save", "CmdOrCtrl+S")?;
    let save_as = item("save-as", "Save As…", "CmdOrCtrl+Shift+S")?;
    let export = item("export-svg", "Export SVG…", "CmdOrCtrl+E")?;
    let quit = item("quit", "Quit", "CmdOrCtrl+Q")?;
    let undo = item("undo", "Undo", "CmdOrCtrl+Z")?;
    let redo = item("redo", "Redo", "CmdOrCtrl+Shift+Z")?;
    let separator = PredefinedMenuItem::separator(app)?;
    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[&new, &open, &save, &save_as, &separator, &export],
    )?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select = PredefinedMenuItem::select_all(app, None)?;
    let edit_separator = PredefinedMenuItem::separator(app)?;
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[&undo, &redo, &edit_separator, &cut, &copy, &paste, &select],
    )?;
    let about = PredefinedMenuItem::about(app, None, None)?;
    let app_separator = PredefinedMenuItem::separator(app)?;
    let application = Submenu::with_items(
        app,
        "Tickwave",
        true,
        &[&about, &app_separator, &quit],
    )?;
    let donate = MenuItem::with_id(
        app,
        "donate",
        "Support the Developer (Buy Me a Coffee)…",
        true,
        None::<&str>,
    )?;
    let help = Submenu::with_items(app, "Help", true, &[&donate])?;
    let menu = Menu::with_items(app, &[&application, &file, &edit, &help])?;
    app.set_menu(menu)?;
    Ok(())
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Startup {
            started: std::time::Instant::now(),
            reported: std::sync::atomic::AtomicBool::new(false),
        })
        .manage(FileAccess::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            install_menu(app)?;
            // Show the window anyway if the frontend never reports ready, e.g. after a script error.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                let main = handle.clone();
                let _ = handle.run_on_main_thread(move || show_main_window(&main));
            });
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("editor-action", event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            open_document,
            save_document,
            exit_editor,
            frontend_ready
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Tickwave");
}
