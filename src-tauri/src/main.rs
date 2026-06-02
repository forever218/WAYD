// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
// 引入 screenshots 库
use screenshots::Screen;

#[tauri::command]
fn capture_screen(path: Option<String>) -> Result<String, String> {
    // 1. 获取保存路径
    let base_path = if let Some(custom_path) = path {
        PathBuf::from(custom_path)
    } else {
        dirs::desktop_dir().unwrap_or_else(|| PathBuf::from("."))
    };

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let screenshot_path = base_path.join(format!("screenshot_{}.png", timestamp));

    // 2. 获取所有屏幕信息
    let screens = Screen::all().map_err(|e| format!("无法获取屏幕信息: {}", e))?;

    // 3. 找到主屏幕 (如果你想截取所有屏幕，可以遍历 screens)
    // 这里逻辑是：尝试找到主屏幕，找不到就用第一个屏幕
    let screen = screens
        .iter()
        .find(|s| s.display_info.is_primary)
        .or_else(|| screens.first())
        .ok_or("未找到任何显示器")?;

    // 4. 执行截屏
    // capture() 方法会自动处理 DPI 缩放，获取完整的物理像素图像
    let image = screen.capture().map_err(|e| format!("截屏失败: {}", e))?;

    // 5. 保存文件
    // image 提供了 save 方法，支持 png, jpg 等格式
    image
        .save(&screenshot_path)
        .map_err(|e| format!("保存文件失败: {}", e))?;

    Ok(screenshot_path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    match fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to delete file: {}", e)),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![capture_screen, delete_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}