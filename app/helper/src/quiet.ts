// Imported first by the CLI: RivetKit's client logs every failed call (an expired code, a revoked
// token) to the terminal, and the CLI says those in its own words.
process.env.RIVET_LOG_LEVEL ??= "silent";
