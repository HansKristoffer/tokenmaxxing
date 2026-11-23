/**
 * The 3D world's tile maps come from `core/src/maps.ts`, the single source of truth (the Tavern, the dorm, the
 * company house and common room, the basement, the dungeon, the four shops and the town with their storefronts).
 * This file only re-exports it, so the 2D and 3D worlds cannot drift apart.
 */
export * from "@tokenmaxxing/core/maps.ts";
