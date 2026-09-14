#!/usr/bin/env node
// Type-checks every project under examples/ against its declared dependencies.
//
// The examples are independent npm projects that depend on PUBLISHED releases of
// this library, so no root gate reaches them. This script is the on-demand check
// that they still compile. It is deliberately NOT wired into prepublishOnly:
// publishing from a clean checkout must not require four example dependency
// trees to be installed.
//
// Every install runs with --no-package-lock. A lockfile under examples/ is what
// produced 28 Dependabot alerts against code that ships to nobody, so writing one
// back is treated as a failure, not a detail.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES_ROOT = join(REPO_ROOT, "examples");
const LOCKFILE = "package-lock.json";

/** Every examples/<group>/<project>/ directory that has a package.json. */
function findExamples(root) {
  if (!existsSync(root)) return [];
  const dirsIn = (path) =>
    readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(path, entry.name));

  return dirsIn(root)
    .flatMap(dirsIn)
    .filter((project) => existsSync(join(project, "package.json")))
    .sort();
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit", shell: false });
}

/** Installs without writing a lockfile, and fails loudly if one appears anyway. */
function install(project) {
  run("npm", ["install", "--no-package-lock", "--no-audit", "--no-fund"], project);

  const lockfile = join(project, LOCKFILE);
  if (existsSync(lockfile)) {
    rmSync(lockfile);
    throw new Error(
      `npm wrote ${LOCKFILE} despite --no-package-lock. It has been removed again, ` +
        `but check how this script invoked npm before trusting the result.`,
    );
  }
}

function typecheck(project) {
  const tsc = join(project, "node_modules", ".bin", "tsc");
  if (!existsSync(tsc)) {
    throw new Error(`no local tsc after install — is typescript a dependency of this example?`);
  }
  run(tsc, ["--noEmit"], project);
}

function main() {
  const projects = findExamples(EXAMPLES_ROOT);
  if (projects.length === 0) {
    console.error(`No example projects found under ${relative(REPO_ROOT, EXAMPLES_ROOT)}/.`);
    process.exit(1);
  }

  for (const project of projects) {
    const name = relative(REPO_ROOT, project);
    console.log(`\n=== ${name}`);
    try {
      install(project);
      typecheck(project);
      console.log(`--- ${name}: ok`);
    } catch (error) {
      console.error(`--- ${name}: FAILED`);
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  console.log(`\nAll ${projects.length} examples type-check cleanly.`);
}

main();
