import { afterAll } from "bun:test";

/** Processes to kill after the whole run (`bun test` never fires process "exit"). */
export const atExit: (() => void)[] = [];

afterAll(() => {
  for (const f of atExit.splice(0)) f();
});
