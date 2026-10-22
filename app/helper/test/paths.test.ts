import { describe, expect, test } from "bun:test";
import { appStateDir, cliConfigDir, configHome, logDir } from "../src/paths.ts";

const mac = { platform: "darwin", env: {}, home: "/Users/ann" } as const;
const linux = { platform: "linux", env: {}, home: "/home/ann" } as const;
const win = { platform: "win32", env: {}, home: "C:\\Users\\Ann" } as const;

describe("where the app keeps its files", () => {
  test("macOS keeps the paths the Swift app and every release since used", () => {
    expect(appStateDir(mac)).toBe("/Users/ann/Library/Application Support/Tokenmaxxing");
    expect(logDir(mac)).toBe("/Users/ann/Library/Logs/Tokenmaxxing");
    expect(cliConfigDir(mac)).toBe("/Users/ann/Library/Application Support/Tokenmaxxing CLI");
  });

  test("Windows uses %APPDATA% and %LOCALAPPDATA%, or where they usually are", () => {
    const env = { APPDATA: "D:\\Roam", LOCALAPPDATA: "D:\\Loc" };
    expect(appStateDir({ ...win, env })).toBe("D:\\Roam\\Tokenmaxxing");
    expect(logDir({ ...win, env })).toBe("D:\\Loc\\Tokenmaxxing\\Logs");
    expect(cliConfigDir({ ...win, env })).toBe("D:\\Roam\\Tokenmaxxing CLI");
    expect(appStateDir(win)).toBe("C:\\Users\\Ann\\AppData\\Roaming\\Tokenmaxxing");
    expect(logDir(win)).toBe("C:\\Users\\Ann\\AppData\\Local\\Tokenmaxxing\\Logs");
  });

  test("Linux follows the XDG variables, or their defaults", () => {
    expect(appStateDir(linux)).toBe("/home/ann/.local/state/tokenmaxxing");
    expect(logDir(linux)).toBe("/home/ann/.local/state/tokenmaxxing/logs");
    expect(cliConfigDir(linux)).toBe("/home/ann/.config/tokenmaxxing");
    const env = { XDG_STATE_HOME: "/s", XDG_CONFIG_HOME: "/c" };
    expect(appStateDir({ ...linux, env })).toBe("/s/tokenmaxxing");
    expect(logDir({ ...linux, env })).toBe("/s/tokenmaxxing/logs");
    expect(cliConfigDir({ ...linux, env })).toBe("/c/tokenmaxxing");
    expect(configHome({ ...linux, env })).toBe("/c");
  });

  test("TOKENMAXXING_CLI_DIR wins everywhere", () => {
    for (const where of [mac, linux, win])
      expect(cliConfigDir({ ...where, env: { TOKENMAXXING_CLI_DIR: "/t" } })).toBe("/t");
  });
});
