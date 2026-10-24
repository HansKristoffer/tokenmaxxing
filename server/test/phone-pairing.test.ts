import { expect, test } from "bun:test";
import { as, client, event, signUp } from "./rivet.ts";

test("a game session can pair a phone once, without granting usage-import permissions", async () => {
  const u = await signUp("phone");
  const primary = as(u.token).player(u.userId);
  const desktop = await client.player.get([String(u.userId)]).redeemLoginCode(await primary.mintLoginCode());
  const before = Date.now();
  const { code, expiresAt } = await as(desktop).player(u.userId).mintPhoneLoginCode();
  expect(expiresAt).toBeGreaterThanOrEqual(before + 120_000);
  expect(expiresAt).toBeLessThanOrEqual(Date.now() + 120_000);
  const phone = await client.player.get([String(u.userId)]).redeemLoginCode(code);
  expect(phone).not.toBe(desktop);
  expect((await as(phone).town.me()).name).toBe(u.name);
  await expect(client.player.get([String(u.userId)]).redeemLoginCode(code)).rejects.toThrow();
  await expect(as(phone).player(u.userId).ingest([event()])).rejects.toThrow();
  await expect(as(phone).player(u.userId).mintLinkCode()).rejects.toThrow();
});

test("anonymous users, other players and sync-only computers cannot make phone codes", async () => {
  const u = await signUp("phoneowner");
  const other = await signUp("phoneother");
  await expect(client.player.get([String(u.userId)]).mintPhoneLoginCode()).rejects.toThrow();
  await expect(as(other.token).player(u.userId).mintPhoneLoginCode()).rejects.toThrow();
  const link = await as(u.token).player(u.userId).mintLinkCode();
  const device = await client.player.get([String(u.userId)]).redeemLinkCode(link, "sync box", "linux");
  await expect(as(device.token).player(u.userId).mintPhoneLoginCode()).rejects.toThrow();
});

test("phone pairing is rate limited and codes remain bounded", async () => {
  const u = await signUp("phonecap");
  const p = as(u.token).player(u.userId);
  const first = await p.mintPhoneLoginCode();
  for (let i = 0; i < 4; i++) await p.mintPhoneLoginCode();
  await expect(p.mintPhoneLoginCode()).rejects.toThrow("Too many pairing codes");
  await p.mintLoginCode();
  await expect(client.player.get([String(u.userId)]).redeemLoginCode(first.code)).rejects.toThrow();
});
