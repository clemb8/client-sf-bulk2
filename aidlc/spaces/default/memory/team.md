# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working

We branch when a change touches published behaviour or dependencies.
Documentation, configuration and internal cleanups go straight to `main`. That
line is affirmed, and it is a deliberate middle position: it rejects both the
trunk-only habit our history shows and the blanket short-lived-feature-branch
default the framework proposes.

It has an immediate consequence for this initiative. Every item in scope —
raising the `axios` range, replacing the linter, moving TypeScript, correcting
`engines`, the packaging allowlist — touches published behaviour or
dependencies, so all of it is branch work. Nothing in this initiative qualifies
for a direct commit to `main`.

What the history shows, for the record, is that this is a change rather than a
description: across 88 commits since 2022-08-16 no human-authored feature branch
has ever existed. Every human change was committed directly to the trunk and
pushed. The only branches that have ever appeared are Dependabot's, merged
through GitHub pull requests (#1 through #10) as merge commits.

We adopt Conventional Commits from here on. The gap is smaller than it looks:
none of the 88 commits conforms, but roughly 22 of the human commits already open
with a verb that maps cleanly onto a type — `add` to `feat`, `fix` to `fix`,
`update` and `adjust` to `chore` or `refactor`. This is punctuation on the style
already practised, not a new discipline. The bare version-number commits that
`npm version` writes stay as they are; that is standard and we do not fight it.

Our cadence is burst-driven maintenance, not a steady flow. The work arrives in
windows — 2022-08 (v0.0.2 through v0.7.5), 2023-02 (v0.8.0), 2023-03, three
Dependabot windows across 2024, and 2025-08 (v0.8.1 plus three follow-ups) — and
the repository is dormant for months in between. We do not claim a continuous
cadence.

This is a solo-maintained package, and npm confirms it: exactly one maintainer,
`clemb8`. There is no reviewer other than the author, no approval chain, no
pairing and no mob. Practices that presuppose a second person do not describe
this project, and we do not adopt them merely because they are a framework
default. The bus factor is itself a security property of a published package,
and we record it as one rather than as an org-chart detail.

For AI-DLC Construction worktrees, the base branch is `main` and the merge target
is `main`.

Branches merge back as **merge commits**. The branch's individual commits are
preserved and the merge itself is recorded, so the trunk keeps the full sequence
of how a change was built rather than a single flattened commit. That applies to
Construction Bolt branches as it does to any other branch we open.

This is a considered divergence from the framework default, which proposes
squash-merge so that each Bolt becomes one commit on the trunk. We chose the
other way: with one maintainer and burst-driven windows separated by months, the
intermediate commits are the record of what was tried, and on a package this
size a flattened trunk buys tidiness we do not need at the cost of history we do.
It is our practice on its own terms, not an exception granted against a policy —
and it happens to match the only merge precedent this repository has, since the
ten Dependabot pull requests also landed as merge commits.

## Walking Skeleton

Off. There is nothing to bootstrap — the package exists, works, and has shipped
twelve released versions. We do not run the skeleton ceremony on this project.

The plan had it switched on, justified as a gate before automated publishing was
wired up. That justification left the initiative when release automation was
deferred to the follow-on work, so the gate was protecting work that is no longer
here. Turning it off resolves that rather than carrying it forward.

Our history is feature-at-a-time in any case: the query wait-for-result method
(v0.1.0), `getFileBody` (v0.6.0) and the `MonitorJob` emitter (v0.8.0) each
arrived whole and shipped as their own release. The single counter-example is
about the release path rather than the library — commit `3670371` ("Add
automatisations versioning", the repository's first day) wired up
`generate-changelog`, `version` and `postversion` before most of the library
existed.

## Testing Posture

- **Methodology**: test-after
- **Ordering**: Implement, then write and run that layer's tests. Verification
  runs in this order on every change — `npm run typecheck` across `src/` and
  `test/`, `npm run lint`, `npm run test` (Vitest, with an 80% line, branch,
  function and statement floor enforced by `npm run coverage`), `npm run build`,
  and a dependency audit on the final commit before publication.

**AMENDED 2026-09-10.** This section previously recorded `custom` with the
ordering "We write no behavioural tests; verification is static". That was
accurate until the maintainer asked, in session, for "a clear npm audit and a
set of automated tests" and lifted the test-suite half of the stamped rule in
`project.md`. A Vitest + nock suite now exists under `test/` — 87 tests, 100%
statements/functions/lines and 90% branches — so the four static gates are no
longer the whole of our verification. The notes below are kept because their
findings still hold; read them as the record of why the suite was needed rather
than as a live description of the posture. Two are now closed:

- The `npm init` placeholder `"test"` script is gone, replaced by `vitest run`.
- The layout trap is undone: `tsconfig.json` no longer excludes `./src/test`
  and `.gitignore` no longer ignores `src/test/`. Tests live in `test/` at the
  repository root, type-checked through `tsconfig.eslint.json` and kept out of
  `dist/` by the build config's `rootDir`.

Additional posture notes (historical, from before the amendment):

- **Why `custom` and not `test-after`.** `test-after` asserts that tests follow
  implementation. Here nothing follows implementation, so the term has no
  referent. The `npm init` placeholder `"test": "echo \"Error: no test
  specified\" && exit 1"` was introduced in the first commit (`6af6519`) and has
  never been touched across 88 commits and 12 published versions; no file
  matching `test` or `spec` has ever been added on any branch. Recording
  `test-after` would also have written into durable memory a cadence this
  initiative's own rules forbid running. `custom` names the four gates that
  actually exist and are actually enforced.
- **The gates are real, not aspirational.** All four run today with no new
  dependency. `prepublishOnly: npm run build` already wires the type check into
  the publish path — that is the one automated gate this project has ever had,
  and it is worth naming rather than glossing as "no tooling".
- **Coverage floor: none, and none inherited.** We do not set an aspirational
  figure, because a floor nothing can measure is not a gate. `org.md` attaches
  its 80% line-coverage floor to named scopes, and the active
  `library-release-hardening` is in none of them. The floor for this package is
  set by "Release Automation and Test Infrastructure", when a coverage tool
  exists to measure it. Until then the four gates above are the whole of our
  verification.
- **A public-surface declaration diff was considered and declined.** The
  compiler alone is our type gate. The proposal, its cost and the reason it was
  declined are recorded in `evidence.md`; it is not an adopted practice and
  should not be reintroduced as one.
- **Test types: none automated.** The four programs under `examples/` are the
  only consumer-shaped code that exists, and they are no check on the working
  tree for two reasons: they need live Salesforce credentials, and each is an
  independent npm project pinned to a *published* version of this package
  (`^0.4.2` to `^0.7.2`), not to the local build.
- **What the gates do not cover, stated plainly.** Runtime behaviour is out of
  reach of every gate above — the polling and retry timing in `waitQueryEnd` and
  `waitJobEnd`, the `MonitorJob` event sequence, `getFileBody` upload behaviour,
  and axios's own runtime changes across the twelve minor versions this
  initiative moves through. A clean audit is also not the same as mitigation for
  the unbounded-size advisory class, because `createAxiosHeader` sets
  `maxBodyLength` and `maxContentLength` to `Infinity` and so opts out of the
  control an axios upgrade restores. We do not let a clean audit imply coverage
  it does not deliver.
- **Test volume: `Standard`, and it belongs to the follow-on work.**
  `aidlc-state.md` sets `Test Strategy: Standard`, and `org.md` says the active
  strategy "still applies in every scope". We keep `Standard` as the target and
  we do not lower it — it is the test volume and test types we intend this
  package to have. It **does not apply to this initiative**, which builds no test
  suite. It applies to "Release Automation and Test Infrastructure", and it
  applies from the moment that work starts rather than at some unfixed later
  point. Nothing in this section licenses a later stage to write tests here in
  order to satisfy `Standard`: the setting is the follow-on's target, and the
  four gates above are the whole of this initiative's verification.
- **What the current gate has already cost us.** Version `0.8.1` was published to
  npm at 2025-08-21T08:45:03Z per the registry. The commit `5398891 fix BulkAPI
  type` was authored 24 seconds later, at 08:45:27Z. A type defect surfaced
  immediately after the release that shipped it.
- **A trap the follow-on work will hit.** `tsconfig.json` excludes `./src/test`
  and `.gitignore` contains `src/test/`. Neither directory has ever existed, so
  tests placed at the conventional location would be both excluded from
  compilation and untracked by git. It reads as a deliberate test-layout
  decision and is `npm init` residue; "Release Automation and Test
  Infrastructure" must undo both.

## Change Control

<!-- Affirmed by the team. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

We publish a library to one place: the public npm registry. There are no
environments to promote through, no staging, no running service to deploy and no
second person to approve a release. `org.md`'s deployment default — deploy on
merge to staging, production gated on tech-lead plus product-owner sign-off in a
CD platform — describes a team shipping a service. It does not describe this
project, and we do not adopt it.

**We publish only from a clean checkout of the tagged commit.** This is the one
release discipline we adopt now, and it is a two-command habit rather than
automation, so it does not reach into the deferred release-automation work. It is
also the precondition that makes our pre-publish audit mean anything: auditing
commit X and publishing tree Y is a control that does not connect to its own
artifact, and this repository has demonstrably done exactly that once.

The release path we run:

1. `npm version <patch|minor|major>`.
2. The `version` script runs `generate-changelog` and stages `CHANGELOG.md`.
3. npm creates the version commit — subject is the bare version number — and the
   `vX.Y.Z` tag.
4. The `postversion` script runs `git push && git push --tags`.
5. `npm publish` is run by hand from a clean checkout of that tag.
   `prepublishOnly` runs `npm run build`, so the `tsc` output in `dist/` is what
   ships.

There is no `.github/` directory, no CI of any kind, no `release` script and no
publish automation. Automating publication is deliberately out of scope and
belongs to "Release Automation and Test Infrastructure", along with npm
provenance attestation, which needs OIDC from a CI runner and cannot be adopted
here.

Facts about this path that we record because they change what "released" means:

- **A tag is not a release.** 21 tags, 12 published versions. `v0.0.2` through
  `v0.3.0` predate the first publish (`0.4.0`, 2022-08-18T17:01:35Z), but
  `v0.6.0`, `v0.7.0` and `v0.7.4` are genuine tag-without-publish gaps.
- **The published `0.8.1` was not built from its own tag.** This is verified, not
  inferred: each candidate commit was built in isolation and compared against the
  real registry tarball. The build from `f125f70` (tag `v0.8.1`) *differs* from
  what shipped; the builds from `e5403f4`, `f942c38` and `5398891` are
  byte-identical to it. The published artifact came from a tree at least two
  commits ahead of its tag.
- **No shipped byte is traceable to a commit.** There is no provenance
  attestation, and `dist/` is gitignored, so the bytes that ship exist in no
  commit at all.

**Packaging moves to an allowlist.** Because a `.npmignore` file exists, npm
ignores `.gitignore` entirely when packing — and our `.npmignore` is nine lines
that list none of the paths `.gitignore` marks as secret or as data. A test pack
using this package's own configuration put `.env`, `accounts.csv`, log files,
coverage output and temp directories into the tarball. That is a credential path
rather than a tidiness question, and it is sharpened by this package being a Bulk
API client whose README and all four examples write `./accounts.csv` to the
project root. The shipped `0.8.1` tarball is clean (37 files, build output and metadata
only), so this has never fired — but it is fail-open, holding only as long as the
working directory happens to be clean at publish time. A `files` allowlist closes
it in one line, and it is in scope for this initiative.

**The changelog tool is pinned or removed in this initiative.**
`generate-changelog` runs `npx github-changes`, which appears only inside that
script string: it is in neither `devDependencies` nor `package-lock.json`, so it
resolves fresh from the registry with no version pin and no integrity hash, and
our mandated audit structurally cannot see it. It has been unmaintained since
2022, and it executes during `npm version` on the machine holding publish
credentials. This is dependency hygiene rather than release automation, so it
belongs here rather than in the follow-on.

**Account-level controls are in place**, confirmed by the maintainer rather than
inspected from the workspace: two-factor authentication is required for
publishing, and the repository has branch protection. These bound the blast
radius of a compromise and nothing in this initiative substitutes for them.

**Dependency PRs are triaged, not merged on sight.** We ask whether a PR changes
a published byte or the declared dependency range. If it changes neither, it is
not a security fix and it does not need merging to close an advisory. All five
currently open Dependabot branches fail that test — three target the
`examples/ingest/ingest-wait-result` fixture, which never ships and never builds;
one is dev-only via `tslint`; and the `axios` branch is lockfile-only, which
reaches no consumer.

Registry-facing metadata drifts and nothing catches it: `engines.node` declares
the exact, end-of-life `"17.1"` and `README.md` still advertises "Node JS -
17.1". Correcting `engines` is in scope.

## Code Style

We write TypeScript compiled by `tsc` with `strict: true`, `target: es2016`,
`module: commonjs` and `declaration: true`, so consumers receive `.d.ts` files.

**Linter only — no formatter.** Formatting stays human habit, and the
single-line guard-brace idiom is preserved deliberately. That decision was made
against a measurement rather than a preference: a formatter would rewrite 362 of
449 lines at its defaults, and still 80 lines when tuned to our existing style,
and that entire residual is the formatter expanding
`if (!delay) { delay = 3000; }` onto three lines — which it has no option to
preserve. A linter checks for mistakes and leaves layout alone.

The replacement for `tslint` is the standard TypeScript linter, **conditional on
auditing its dependency tree before adoption**. A replacement brings its own
transitive tree, and this initiative could otherwise close five vulnerable
packages and reopen an unknown number in the same commit. If the audit turns up
advisories, the choice returns to the maintainer.

Our current ruleset lives in `tslint.json`: `tslint:recommended` with four rules
relaxed. Two things about it are easy to get wrong, so we state them. First, the
source passes it clean — `tslint -c tslint.json -p tsconfig.json` exits 0, and a
deliberately violating probe file produces findings, so the clean result is
genuine conformance rather than a config that checks nothing. Second, it checks
less than it appears to: `tslint:recommended` contains **zero** formatting rules
— all 46 enabled rules are semantic — so every formatting convention below is
unenforced habit, surviving on periodic hand-sweeps. It also does not enable
`no-unused-variable`, and `tsconfig.json` sets neither `noUnusedLocals` nor
`noUnusedParameters`, which is why a dead `AxiosResponseHeaders` import has sat
at `BulkAPI.ts:1` in a published package for a year. Porting the ruleset is
therefore nearly free, but that is not an argument for porting — the real
question the new tool answers is what we want it to catch.

**We never mutate an object our caller owns**, and we fix the two existing sites
in this initiative. `query/query.ts:24` and `:38` assign to
`requestConfig.endpoint`, an object constructed and owned by
`BulkAPI.getRequestConfig()`. It is harmless only because that method allocates
a fresh object per call — an invariant nothing states and nothing checks. Hoist
`getRequestConfig` out of the loop in `iterateThroughResults` as an obvious
optimisation and pagination silently corrupts into
`.../results?locator=A?locator=B`. The rule is narrow by design: it does not
forbid local accumulation, parameter defaulting or a constructor assembling its
own state, and scoped this way the fix is roughly two lines.

The conventions the source holds to:

- **Formatting**: two-space indent, double quotes, semicolons everywhere, a
  trailing newline on every file. Trailing commas are inconsistent — exactly one,
  at `src/index.ts:20`. Line length is unconstrained: 14 lines exceed 120
  characters, longest 156.
- **The guard-brace idiom**: single-statement guards on one line, 12 occurrences,
  kept deliberately.
- **Naming**: `PascalCase` filenames for the class and interfaces, matching the
  exported type; lowercase feature modules; `camelCase` members; transport
  functions prefixed `request*`. Every class member carries an explicit `public`
  or `private` — habit rather than an enforced rule, and worth stating so it
  survives the tool change. Compound locals drop camelCase in places
  (`axiosresponse`, `jobuploadresponse`); no linter can catch that, so it has to
  be stated if we want it.
- **File organisation**: one interface per file under `src/interfaces/` (10
  files, 6 to 14 lines); a folder per feature (`src/ingest/`, `src/query/`);
  `src/index.ts` as a barrel; `src/BulkAPI.ts` as the single default-exported
  facade. Seventeen files, 449 lines, largest 171. The three files named
  `utils.ts` are a grab-bag rather than pure helpers — one holds polling
  orchestration plus a module singleton, one holds URL building *and* error
  policy, one is file I/O — and that is the direct cause of the layering
  inversion below.
- **Layering**: facade to transport to interfaces, with one inversion.
  `src/utils.ts` names `BulkAPI` in its signatures, so the two files are mutually
  dependent *in the type graph*. The import is type-only, tsc elides it, and the
  emitted `utils.js` requires only `events` — there is no runtime cycle today. It
  becomes one the moment `BulkAPI` is used as a value there.
- **Error handling.** Our contract is that we do not catch: axios rejections
  propagate to the caller unchanged, and the README teaches consumers to wrap
  calls themselves. There is no `try`/`catch` anywhere in `src/`. Deliberate
  failures use `throw new Error(...)` — two inline in `BulkAPI.ts` (lines 110 and
  134) and three centralised in `query/utils.ts::handleQueryNotComplete`. We
  record one known deviation, because the contract above is a contract and not a
  description: `utils.ts::getFinalBulkState` polls inside a `setInterval` whose
  `async` callback has no rejection path and whose promise captures no `reject`,
  so a failure during polling never reaches the caller — it becomes an unhandled
  rejection, the interval is never cleared, and the awaiting call never settles.
  This affects `waitQueryEnd`, `waitJobEnd`, `getQueryFinalResults`,
  `submitAndGetQueryResults` and `createAndWaitJobResult`. Fixing it is in scope
  for this initiative. A second, smaller inconsistency:
  `ingest/utils.ts::getFileBody` rejects with a plain string rather than an
  `Error`, so consumers lose the stack.
- **Typing**: `strict` is on, no `as any` and no angle-bracket assertion. One
  loose spot: `BulkAPI.ts:155` types response headers as `Record<string, any>`.
- **Third-party types in the public surface**: one method deep.
  `AxiosResponse` appears only in `getQueryResults`; `RequestConfig` and
  `AxiosRequestConfig` do not leak through `BulkAPI`. But `package.json` declares
  no `exports`, no `files` and no `types`, so every emitted file is a public deep
  entry point and `createAxiosHeader` is reachable as
  `client-sf-bulk2/dist/utils` with axios types and an `any` in its signature.
  That is the same declare-what-is-public instinct as the packaging allowlist,
  one layer down.
- **Logging**: none in `src/`, which is right for a library. The one credential
  hazard we own is taught rather than coded: the README and all four examples use
  `catch (ex) { console.log(ex); }`, and an axios rejection carries
  `error.config.headers.Authorization` — the live Salesforce bearer token. Our
  own documented error-handling pattern prints the credential.
- **Shared state**: `MonitorJob` is a module-level `EventEmitter` singleton in
  `src/utils.ts`, shared across every `BulkAPI` instance in a process, and part
  of the public surface.

Two documents in the working tree appear to govern this code and do not:
`.claude/rules/coding-style.md`, which mandates blanket immutability, and
`.claude/rules/git-workflow.md`, which mandates Conventional Commits. Both are
git-ignored by `.gitignore` line 132 and have never been committed in any ref;
they are personal tooling configuration installed alongside an unrelated
assistant, not project policy. We do not treat them as binding and we do not
record this project as being in violation of them. The two practices they name
were each put to the maintainer on their own merits and decided here — the narrow
caller-owned-mutation rule adopted above, and Conventional Commits adopted under
Way of Working. Neither was inherited from those files.

One related defect worth knowing: `.gitignore` now ignores `.claude` while 289
`.claude/` files are already tracked, so any *new* file added under `.claude/`
from here on is silently ignored. That is the same config-drift class as
`engines: "17.1"`, as the `tslint`/`typedoc` devDependencies no script invokes,
as the dead `trailing-comma` relaxation in `tslint.json`, and as
`tsconfig.json`'s `include` entry for `examples/query/exampleQuery.ts`, a file
that does not exist. Config drifts here and nothing catches it; that is this
project's dominant defect class.
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
