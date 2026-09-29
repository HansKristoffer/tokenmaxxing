import { afterAll, afterEach } from "bun:test";

/** Processes to kill after the whole run (`bun test` never fires process "exit"). */
export const atExit: (() => void)[] = [];

/** Run after every test, in every file (a preload's hooks are global). */
export const afterEveryTest: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const f of afterEveryTest) await f();
});

afterAll(() => {
  for (const f of atExit.splice(0)) f();
});
