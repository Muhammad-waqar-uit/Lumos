use std::fs::{self, File, OpenOptions};
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
const POLL_INTERVAL: Duration = Duration::from_millis(200);

/// The loader and the entry point are passed *relative* to the runtime directory, which is also the
/// child's working directory. Node refuses an absolute Windows path as an ES module argument
/// ("On Windows, absolute paths must be valid file:// URLs"), so passing the resolved path killed
/// the bundled daemon the moment it was spawned.
const LOADER_ARG: &str = "./node_modules/tsx/dist/loader.mjs";
const ENTRYPOINT_ARG: &str = "src/server.ts";
const LOG_FILE: &str = "daemon.log";

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

/// Start the daemon beside the window instead of in front of it.
///
/// Waiting for the daemon here used to block the UI thread for up to thirty seconds, and a failure
/// was returned from `setup`, which closes the app. Neither belongs on the launch path: the window
/// opens at once, the daemon is spawned on its own thread, and a daemon that will not start leaves
/// an app in its offline state plus a line in `daemon.log` rather than an app that never appears.
pub fn start(app: &AppHandle) -> Arc<DaemonProcess> {
    let process = Arc::new(DaemonProcess(Mutex::new(None)));
    app.manage(Arc::clone(&process));

    let handle = app.clone();
    let shared = Arc::clone(&process);
    thread::spawn(move || {
        if let Err(message) = launch(&handle, &shared) {
            append_log(&handle, &message);
        }
    });

    process
}

fn launch(app: &AppHandle, process: &Arc<DaemonProcess>) -> Result<(), String> {
    // A daemon already answering on the port owns it - a second one could only fail to bind - so it
    // is used as it is. That is the ordinary case while developing, and the recovery case after a
    // launch that was killed before it could clean up.
    if daemon_is_responding() {
        return Ok(());
    }

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
        "Lumos could not create its WhatsApp session folder. Check Windows app-data permissions."
            .to_owned()
    })?;

    let executable = runtime_dir.join(if cfg!(windows) { "node.exe" } else { "node" });
    if !executable.is_file() || !runtime_dir.join(ENTRYPOINT_ARG).is_file() {
        return Err("Lumos could not read the installed daemon files. Reinstall Lumos.".to_owned());
    }

    let config_file = data_dir.join("lumos.config.json");
    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join(LOG_FILE))
        .ok();

    let mut command = Command::new(&executable);
    command
        .arg("--import")
        .arg(LOADER_ARG)
        .arg(ENTRYPOINT_ARG)
        .current_dir(&runtime_dir)
        .env("VAULT_PATH", &vault_dir)
        .env("LUMOS_CONFIG", &config_file)
        .env("LUMOS_AUTH_DIR", &auth_dir)
        .env("PORT", DAEMON_PORT.to_string())
        .stdin(Stdio::null());
    if let Some(file) = &log {
        // A daemon that dies on startup says why on stderr; discarding it left nothing to read.
        command.stdout(pipe_or_null(file));
        command.stderr(pipe_or_null(file));
    } else {
        command.stdout(Stdio::null()).stderr(Stdio::null());
    }
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let child = command
        .spawn()
        .map_err(|_| "Lumos could not start its local daemon.".to_owned())?;
    if let Ok(mut guard) = process.0.lock() {
        *guard = Some(child);
    }

    let deadline = Instant::now() + START_TIMEOUT;
    while Instant::now() < deadline {
        if daemon_is_responding() {
            return Ok(());
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
        if exited {
            process.stop();
            return Err(
                "Lumos's local daemon stopped while starting. See daemon.log in its data folder."
                    .to_owned(),
            );
        }
        thread::sleep(POLL_INTERVAL);
    }

    process.stop();
    Err(
        "Lumos's local daemon took too long to start. Try closing other apps and restarting Lumos."
            .to_owned(),
    )
}

fn pipe_or_null(log: &File) -> Stdio {
    match log.try_clone() {
        Ok(file) => Stdio::from(file),
        Err(_) => Stdio::null(),
    }
}

/// Our own failures go to the same file as the child's output, so one place holds the whole story.
fn append_log(app: &AppHandle, message: &str) {
    let Ok(data_dir) = app.path().app_data_dir() else {
        return;
    };
    let _ = fs::create_dir_all(&data_dir);
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join(LOG_FILE))
    {
        use std::io::Write;
        let _ = writeln!(file, "{message}");
    }
}

fn find_runtime_dir(resource_dir: &Path) -> Option<PathBuf> {
    [
        resource_dir.join("daemon-runtime"),
        resource_dir.join("resources").join("daemon-runtime"),
        resource_dir.to_path_buf(),
    ]
    .into_iter()
    .find(|dir| dir.join(LOADER_ARG).is_file())
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

#[cfg(test)]
mod tests {
    use super::{ENTRYPOINT_ARG, LOADER_ARG};
    use std::path::Path;

    /// The bug this guards: an absolute path here made Node refuse the entry point outright, so the
    /// daemon died as it was spawned and the window closed with it.
    #[test]
    fn the_daemon_arguments_stay_relative_to_the_runtime_directory() {
        for arg in [LOADER_ARG, ENTRYPOINT_ARG] {
            assert!(!Path::new(arg).is_absolute(), "{arg} must not be absolute");
            assert!(!arg.contains(':'), "{arg} must not name a drive");
        }
        assert!(LOADER_ARG.starts_with("./"));
    }
}
