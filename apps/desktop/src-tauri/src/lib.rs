// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod daemon;

use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{WebviewUrl, WebviewWindowBuilder};
use url::Url;

static NEXT_LINK_VIEWER: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn is_safe_web_url(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
        && url.username().is_empty()
        && url.password().is_none()
}

#[tauri::command]
fn open_link_viewer(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "This link is not a valid URL.".to_owned())?;
    if !is_safe_web_url(&parsed) {
        return Err("Only credential-free HTTP and HTTPS links can open in Lumos.".to_owned());
    }

    let label = format!(
        "link-viewer-{}-{}",
        std::process::id(),
        NEXT_LINK_VIEWER.fetch_add(1, Ordering::Relaxed)
    );
    let title = parsed.host_str().unwrap_or("External link").to_owned();
    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed))
        .title(title)
        .inner_size(1100.0, 760.0)
        .center()
        // No capability matches this generated label, so the remote page has no Tauri IPC access.
        // Redirects and links remain useful, but never leave the HTTP(S) URL space.
        .on_navigation(is_safe_web_url)
        .build()
        .map(|_| ())
        .map_err(|_| "Lumos could not open this link.".to_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            daemon::start(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, open_link_viewer])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { code: None, .. } => {
                daemon::stop_on_exit(app);
            }
            tauri::RunEvent::Exit => daemon::stop_on_exit(app),
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::is_safe_web_url;
    use url::Url;

    #[test]
    fn allows_http_and_https_urls_without_credentials() {
        for raw in ["http://localhost:3000/", "https://example.com/article"] {
            assert!(is_safe_web_url(&Url::parse(raw).expect("valid URL")));
        }
    }

    #[test]
    fn rejects_non_web_schemes_and_embedded_credentials() {
        for raw in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "https://user:password@example.com/",
        ] {
            assert!(!is_safe_web_url(&Url::parse(raw).expect("valid URL")));
        }
    }
}
