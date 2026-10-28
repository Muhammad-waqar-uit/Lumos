use std::fs;
use std::net::{TcpStream, ToSocketAddrs};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const DAEMON_PORT: u16 = 3001;
const START_TIMEOUT: Duration = Duration::from_secs(30);

pub struct DaemonProcess(Mutex<Option<Child>>);

impl DaemonProcess {
    pub fn stop(&self) {
        if let Ok(mut child) = self.0.lock() {
            stop_child(&mut child);
        }
    }
}

impl Drop for DaemonProcess {
    fn drop(&mut self) {
        if let Ok(child) = self.0.get_mut() {
            stop_child(child);
        }
    }
}

fn stop_child(child: &mut Option<Child>) {
    if let Some(mut child) = child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

pub fn start(app: &AppHandle) -> Result<Arc<DaemonProcess>, String> {
    let resource_dir = app.path().resource_dir().map_err(|_| {
        "Lumos could not locate its bundled daemon. Reinstall Lumos and try again.".to_owned()
    })?;
    let runtime_dir = find_runtime_dir(&resource_dir).ok_or_else(|| {
        "Lumos could not find its bundled Node runtime. Reinstall Lumos and try again.".to_owned()
    })?;
    let data_dir = app.path().app_data_dir().map_err(|_| {
        "Lumos could not locate its local data folder. Check Windows app-data permissions."
            .to_owned()
    })?;
    let vault_dir = data_dir.join("vault");
    let auth_dir = data_dir.join("auth_info");
    fs::create_dir_all(&vault_dir).map_err(|_| {
        "Lumos could not create its local notes folder. Check Windows app-data permissions."
            .to_owned()
    })?;
    fs::create_dir_all(&auth_dir).map_err(|_| {
        "Lumos could not create its WhatsApp session folder. Check Windows app-data permissions.".to_owned()
    })?;

    #[cfg(debug_assertions)]
    if daemon_is_responding() {
        let app_process = Arc::new(DaemonProcess(Mutex::new(None)));
        app.manage(Arc::clone(&app_process));
        return Ok(app_process);
    }

    let executable = runtime_dir.join(if cfg!(windows) { "node.exe" } else { "node" });
    let entrypoint = runtime_dir.join("src/server.ts");
    let config_file = data_dir.join("lumos.config.json");
    if !executable.is_file() || !entrypoint.is_file() {
        return Err("Lumos could not read the installed daemon files. Reinstall Lumos.".to_owned());
    }

    let mut command = Command::new(executable);
    command
        .arg("--import")
        .arg(runtime_dir.join("node_modules/tsx/dist/loader.mjs"))
        .arg(entrypoint)
        .current_dir(&runtime_dir)
        .env("VAULT_PATH", &vault_dir)
        .env("LUMOS_CONFIG", &config_file)
        .env("LUMOS_AUTH_DIR", &auth_dir)
        .env("PORT", DAEMON_PORT.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let child = command
        .spawn()
        .map_err(|_| "Lumos could not start its local daemon.".to_owned())?;

    let process = Arc::new(DaemonProcess(Mutex::new(Some(child))));
    app.manage(Arc::clone(&process));

    let deadline = Instant::now() + START_TIMEOUT;
    let mut consecutive_failures = 0;
    while Instant::now() < deadline {
        if daemon_is_responding() {
            consecutive_failures = 0;
            thread::sleep(Duration::from_millis(500));
            if daemon_is_responding() {
                return Ok(process);
            }
        } else {
            consecutive_failures += 1;
        }
        let exited = process
            .0
            .lock()
            .ok()
            .and_then(|mut guard| {
                guard
                    .as_mut()
                    .map(|child| child.try_wait().ok().flatten().is_some())
            })
            .unwrap_or(true);
        if exited && consecutive_failures >= 2 {
            process.stop();
            return Err(
                "Lumos's local daemon stopped while starting. Check the app-data folder and try again."
                    .to_owned(),
            );
        }
        thread::sleep(Duration::from_millis(200));
    }

    process.stop();
    Err(
        "Lumos's local daemon took too long to start. Try closing other apps and restarting Lumos."
            .to_owned(),
    )
}

fn find_runtime_dir(resource_dir: &Path) -> Option<PathBuf> {
    [
        resource_dir.join("daemon-runtime"),
        resource_dir.to_path_buf(),
    ]
    .into_iter()
    .find(|dir| dir.join("node_modules/tsx/dist/loader.mjs").is_file())
}

fn daemon_is_responding() -> bool {
    let Ok(addresses) = ("127.0.0.1", DAEMON_PORT).to_socket_addrs() else {
        return false;
    };
    addresses
        .into_iter()
        .any(|address| TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok())
}

pub fn stop_on_exit(app: &AppHandle) {
    if let Some(process) = app.try_state::<Arc<DaemonProcess>>() {
        process.stop();
    }
}
