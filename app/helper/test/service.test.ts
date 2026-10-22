import { describe, expect, test } from "bun:test";
import { serviceScript, taskXml, winQuote } from "../src/service.ts";

const program = ["C:\\Users\\Ann Lee\\bin\\tokenmaxxing.exe", "run"];

describe("the Windows service", () => {
  test("winQuote quotes the way CommandLineToArgvW reads it back", () => {
    expect(winQuote("run")).toBe("run");
    expect(winQuote("")).toBe('""');
    expect(winQuote("C:\\a b\\c.exe")).toBe('"C:\\a b\\c.exe"');
    expect(winQuote('say "hi"')).toBe('"say \\"hi\\""');
    // Backslashes only matter before a quote, including the closing one.
    expect(winQuote("C:\\a b\\")).toBe('"C:\\a b\\\\"');
    expect(winQuote('a\\"b c')).toBe('"a\\\\\\"b c"');
  });

  test("the batch file sets the environment, logs, and exits with run's code", () => {
    const env = { PATH: "C:\\bin;C:\\Prog (x86)", X: "50%", BAD: 'a"b' };
    const script = serviceScript(program, env, "C:\\L o\\cli.log");
    expect(script.split("\r\n")).toEqual([
      "@echo off",
      'set "PATH=C:\\bin;C:\\Prog (x86)"',
      'set "X=50%%"',
      '"C:\\Users\\Ann Lee\\bin\\tokenmaxxing.exe" run >> "C:\\L o\\cli.log" 2>&1',
      "exit /b %ERRORLEVEL%",
      "",
    ]);
  });

  test("a program path with cmd syntax in it is quoted", () => {
    expect(serviceScript(["C:\\a&b\\t.exe", "run"], {}, "l")).toContain('"C:\\a&b\\t.exe" run >> "l"');
  });

  test("the task runs at this user's logon, hidden, and restarts only on failure", () => {
    const xml = taskXml("C:\\Users\\Ann & Lee\\Logs\\service.cmd", "PC\\Ann & Lee");
    expect(xml).toContain("<LogonTrigger>");
    expect(xml).toContain("<UserId>PC\\Ann &amp; Lee</UserId>");
    expect(xml).toContain("<LogonType>InteractiveToken</LogonType>");
    expect(xml).toContain("<RunLevel>LeastPrivilege</RunLevel>");
    expect(xml).toContain("<Command>&quot;C:\\Users\\Ann &amp; Lee\\Logs\\service.cmd&quot;</Command>");
    expect(xml).toContain("<RestartOnFailure>");
    expect(xml).toContain("<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>");
    expect(xml).toContain("<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>");
  });

  test("without a known user the task leaves the user out", () => {
    expect(taskXml("C:\\s.cmd", null)).not.toContain("<UserId>");
  });
});
