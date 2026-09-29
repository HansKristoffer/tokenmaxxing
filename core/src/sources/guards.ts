/** Type guards for the loose JSON the log parsers read. */

/** A non-empty string. */
export const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** A finite number. */
export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
