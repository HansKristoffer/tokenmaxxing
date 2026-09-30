fn main() {
    // The server the app talks to is baked in at build time. A release must name it; a dev build
    // defaults to a local server (see SERVER_URL in lib.rs).
    println!("cargo:rerun-if-env-changed=TOKENMAXXING_SERVER_URL");
    if std::env::var("PROFILE").as_deref() == Ok("release")
        && std::env::var("TOKENMAXXING_SERVER_URL").is_err()
    {
        panic!("set TOKENMAXXING_SERVER_URL to the production server for a release build");
    }
    // App commands are denied unless a capability allows them: all of these are for the game window
    // (added in lib.rs).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "enter_world",
            "update_status",
            "install_update",
            "open_link",
            "link_computer",
        ]),
    ))
    .expect("failed to run tauri-build")
}
