// No console window on Windows, should we ever build there.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tokenmaxxing_lib::run()
}
