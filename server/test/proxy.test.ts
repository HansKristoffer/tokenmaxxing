import { expect, test } from "bun:test";
import { close } from "../src/proxy.ts";

test("closes pass on as codes that can be sent, so a dropped socket can't crash the server", () => {
  const sent: [number | undefined, string | undefined][] = [];
  const socket = { close: (code?: number, reason?: string) => void sent.push([code, reason]) };
  close(socket, 1006, "");
  close(socket, 1005, "");
  close(socket, 1011, "engine unreachable");
  close(socket, 4001, "kicked");
  expect(sent).toEqual([
    [1000, ""],
    [1000, ""],
    [1011, "engine unreachable"],
    [4001, "kicked"],
  ]);
});
