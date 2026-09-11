import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load `.env` into `process.env` before the suite resolves its configuration.
 *
 * Registered as a vitest `setupFile`, which runs before each test file is
 * imported — `helpers/suite.ts` reads the environment at import time, so a
 * `globalSetup` would be too late in a worker.
 *
 * Hand-rolled rather than `dotenv`, for the same reason the CSV parser is: this
 * package's whole point right now is a clean `npm audit`, and a twenty-line
 * parser is not worth another dependency tree. It supports what a `.env` needs
 * and nothing more — `KEY=value`, `#` comments, blank lines, optional surrounding
 * quotes, and `export ` prefixes.
 *
 * A real environment variable always wins, so CI and shell overrides are not
 * silently replaced by a stale file.
 */
export function loadDotEnv(path = resolve(process.cwd(), ".env")): void {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf("=");
    if (separator <= 0) continue;

    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    let value = withoutExport.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();
