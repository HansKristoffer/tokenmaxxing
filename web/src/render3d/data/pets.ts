/**
 * A snapshot of the 2D pet data the 3D pets are built from, so this slice needs nothing from core.
 * Sources: `core/src/pets.ts` (PET_VARIANTS, PET_NAMED), `core/src/shop.ts` + `core/src/loot.ts` (the pets),
 * `core/src/wardrobe.ts` + `web/src/art/wardrobe.ts` (pet gear). Only ever append, like the originals.
 */

/** Pets by their 2D index (`Look.pet`): 0 is none. */
export const PET_SPECIES = [
  "none",
  "duck",
  "cat",
  "dog",
  "dragon",
  "panda",
  "orb", // Singularity orb, a level-30 reward
  "golem", // Sand golem (rate-limit boss loot)
  "goldfish", // Context-window boss loot
  "forkedcat", // Merge-conflict boss loot
  "ghost", // Loot ghost
  "piggy", // Invoice boss loot
] as const;
export type Species = (typeof PET_SPECIES)[number];

export const PET_NAME: Record<Species, string> = {
  none: "No pet",
  duck: "Duck",
  cat: "Cat",
  dog: "Dog",
  dragon: "Dragon",
  panda: "Panda",
  orb: "Singularity orb",
  golem: "Sand golem",
  goldfish: "Goldfish",
  forkedcat: "Forked cat",
  ghost: "Ghost",
  piggy: "Piggy bank",
};

/** `Look.petVariant` n is `PET_VARIANTS[species][n - 1]`; 0 is the pet as the shop sells it. */
export const PET_VARIANTS: Partial<Record<Species, readonly string[]>> = {
  duck: ["mallard", "rubber", "pekin", "swedish", "duckling", "ghost"],
  cat: ["black", "tuxedo", "siamese", "calico", "greytabby", "sphynx", "witch"],
  dog: [
    "dalmatian",
    "husky",
    "shiba",
    "golden",
    "pug",
    "corgi",
    "dachshund",
    "poodle",
    "frenchie",
    "chowchow",
    "chihuahua",
    "greyhound",
    "jackolantern",
  ],
  dragon: ["red", "ice", "gold", "shadow", "skeleton", "baby"],
  panda: ["qinling", "polar", "albino", "red"],
};

/** Easter-egg costumes: a pet of this name, species and variant wears the `art` outfit. */
export const PET_NAMED: readonly { name: string; species: Species; variant: string; art: string }[] = [
  { name: "Penny", species: "dog", variant: "greyhound", art: "penny-sweater" },
  { name: "Nemo", species: "dog", variant: "pug", art: "nemo-wookiee" },
];

/** Pet gear, by `Look.petwear` (1-based). */
export const PETWEAR = [
  { name: "Red bandana", at: "neck" },
  { name: "Pink bow", at: "top" },
  { name: "Bow tie", at: "neck" },
  { name: "Party hat", at: "top" },
  { name: "Gold collar", at: "neck" },
  { name: "Propeller cap", at: "top" },
  { name: "Winter scarf", at: "neck" },
] as const;

/** Owners at this level or above (the cap) have their pet crowned. */
export const LEGENDARY_LEVEL = 50;
