fn main() {
    // The server the app talks to is baked in at build time. A release must name it; a dev build
    // defaults to a local server (see SERVER_URL in lib.rs).
    println!("cargo:rerun-if-env-changed=TOKENMAXXING_SERVER_URL");
    if std::env::var("PROFILE").as_deref() == Ok("release")
        && std::env::var("TOKENMAXXING_SERVER_URL").is_err()
    {
        panic!("set TOKENMAXXING_SERVER_URL to the production server for a release build");
    }
    tauri_build::build()
}
