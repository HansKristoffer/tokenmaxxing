import { describe, expect, test } from "bun:test";
import { FESTIVE_THEMES, festiveTheme, THEME_STEPS, THEMES, themeOf } from "../src/themes.ts";
import { drumSteps, notes, voiceSteps } from "../src/tunes.ts";

describe("room themes", () => {
  test("every voice fills the whole loop and parses", () => {
    for (const t of THEMES) {
      expect(voiceSteps(t.lead)).toBe(THEME_STEPS);
      expect(voiceSteps(t.bass)).toBe(THEME_STEPS);
      expect(drumSteps(t.drums)).toBe(THEME_STEPS);
      expect(() => notes(t.lead)).not.toThrow();
      expect(() => notes(t.bass)).not.toThrow();
    }
  });

  test("each kind of room has its own theme", () => {
    expect(themeOf("town").id).toBe("town");
    expect(themeOf("hq:3").id).toBe("company");
    expect(themeOf("office:7").id).toBe("office");
    expect(themeOf("inn").id).toBe("tavern");
    expect(themeOf("basement").id).toBe("tavern");
    expect(themeOf("dungeon").id).toBe("raid");
  });

  test("every registered festive track is a whole loop under its own id", () => {
    for (const [festive, rooms] of Object.entries(FESTIVE_THEMES))
      for (const [room, t] of Object.entries(rooms)) {
        expect(String(t.id)).toBe(`festive-${festive}-${room}`);
        expect(voiceSteps(t.lead)).toBe(THEME_STEPS);
        expect(voiceSteps(t.bass)).toBe(THEME_STEPS);
        expect(drumSteps(t.drums)).toBe(THEME_STEPS);
        expect(() => notes(t.lead)).not.toThrow();
        expect(() => notes(t.bass)).not.toThrow();
      }
  });

  test("a festive track replaces its room's tune while the theme is on, and only then", () => {
    const track = { ...THEMES.find((t) => t.id === "town")!, id: "festive-paaske-town" as const };
    const registered = FESTIVE_THEMES.paaske;
    FESTIVE_THEMES.paaske = { town: track };
    try {
      expect(themeOf("town", "paaske")).toBe(track);
      expect(festiveTheme("paaske", "town")).toBe(track);
      expect(themeOf("town", null).id).toBe("town");
      expect(themeOf("town", "nonesuch" as never).id).toBe("town");
      expect(themeOf("inn", "paaske").id).toBe("tavern");
      expect(themeOf("dungeon", "paaske").id).toBe("raid");
    } finally {
      FESTIVE_THEMES.paaske = registered;
    }
  });
});
