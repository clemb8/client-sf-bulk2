import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

// These tests assert repository shape rather than library behaviour.
//
// A stale lockfile under examples/ produced 28 Dependabot alerts against code
// that ships to nobody. The examples are outside every other gate — excluded
// from ESLint, absent from the type-check config and the files allowlist — so
// nothing but these assertions stops that state coming back.
//
// They read the real tree with node:fs and make no network call, so they are
// cheap enough to live in the ordinary suite. The complementary check that the
// examples actually compile is `npm run check:examples`, which needs an install
// and is deliberately on demand.

/**
 * Walks up until it finds this library's own package.json, so the tests do not
 * depend on where the runner was invoked from. `import.meta.url` would be the
 * obvious way to do this, but the root tsconfig compiles `test/` as commonjs and
 * rejects it.
 */
function findRepoRoot(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, "utf-8")) as { name?: string };
      if (parsed.name === "client-sf-bulk2") return dir;
    }
    if (dirname(dir) === dir) throw new Error(`no client-sf-bulk2 package.json above ${start}`);
  }
}

const REPO_ROOT = findRepoRoot(process.cwd());
const EXAMPLES_ROOT = join(REPO_ROOT, "examples");
const CURRENT_LIBRARY_RANGE = "^0.9.1";

interface ExampleProject {
  readonly dir: string;
  readonly name: string;
  readonly manifest: Record<string, unknown>;
}

function subdirectories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(path, entry.name));
}

/** Discovered, never hard-coded: adding or removing an example changes what is checked. */
function findExamples(): ExampleProject[] {
  return subdirectories(EXAMPLES_ROOT)
    .flatMap(subdirectories)
    .filter((dir) => existsSync(join(dir, "package.json")))
    .sort()
    .map((dir) => ({
      dir,
      name: relative(REPO_ROOT, dir),
      manifest: JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as Record<string, unknown>,
    }));
}

function filesRecursive(path: string, skip: readonly string[]): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    if (entry.isDirectory()) return skip.includes(entry.name) ? [] : filesRecursive(full, skip);
    return [full];
  });
}

function dependencyNames(manifest: Record<string, unknown>): string[] {
  const groups = ["dependencies", "devDependencies"] as const;
  return groups.flatMap((group) => Object.keys((manifest[group] as Record<string, string>) ?? {}));
}

const examples = findExamples();

describe("examples/ hygiene", () => {
  it("finds the example projects it is meant to check", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  // FR1.3 — a lockfile here is what Dependabot resolves and scans.
  it("has no package-lock.json anywhere under examples/", () => {
    const lockfiles = filesRecursive(EXAMPLES_ROOT, ["node_modules", "dist"])
      .filter((file) => file.endsWith("package-lock.json"))
      .map((file) => relative(REPO_ROOT, file));

    expect(lockfiles).toEqual([]);
  });

  // FR3.1 — an example pinned to an old release teaches an old API.
  it("pins every example to the current library range", () => {
    const wrong = examples
      .filter((example) => {
        const deps = (example.manifest.dependencies as Record<string, string>) ?? {};
        return deps["client-sf-bulk2"] !== CURRENT_LIBRARY_RANGE;
      })
      .map((example) => example.name);

    expect(wrong).toEqual([]);
  });

  // FR3.3 — @types/jsforce sat in every example, including ones importing no jsforce.
  it("declares @types/jsforce only where jsforce is actually imported", () => {
    const dead = examples
      .filter((example) => {
        if (!dependencyNames(example.manifest).includes("@types/jsforce")) return false;
        const sources = filesRecursive(example.dir, ["node_modules", "dist"]).filter((file) => file.endsWith(".ts"));
        return !sources.some((file) => readFileSync(file, "utf-8").includes("from 'jsforce'"));
      })
      .map((example) => example.name);

    expect(dead).toEqual([]);
  });

  // FR3.4 — all four shipped the same npm init placeholder identity.
  it("gives every example a distinct name and no placeholder test script", () => {
    const names = examples.map((example) => example.manifest.name);
    expect(new Set(names).size).toBe(examples.length);

    const placeholders = examples
      .filter((example) => {
        const scripts = (example.manifest.scripts as Record<string, string>) ?? {};
        return typeof scripts.test === "string" && scripts.test.includes("no test specified");
      })
      .map((example) => example.name);

    expect(placeholders).toEqual([]);
  });

  // FR4.1 / FR4.2 — the check must exist, and must stay out of the publish path.
  it("defines check:examples and leaves it unwired from every other script", () => {
    const rootManifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };

    expect(rootManifest.scripts["check:examples"]).toBeDefined();

    const callers = Object.entries(rootManifest.scripts)
      .filter(([name, command]) => name !== "check:examples" && command.includes("check:examples"))
      .map(([name]) => name);

    expect(callers).toEqual([]);
  });
});
