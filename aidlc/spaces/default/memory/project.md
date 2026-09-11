# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Change Control

<!-- Project-specific. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER mutate an object the caller owns. (Q10. Narrow by design: local (affirmed 2026-09-10)
accumulation, parameter defaulting and a constructor assembling its own state (affirmed 2026-09-10)
are all permitted. The two existing sites, `query/query.ts:24` and `:38`, are (affirmed 2026-09-10)
fixed in this initiative.) (affirmed 2026-09-10)
- NEVER ship a change that breaks consumers without a documented absence of a (affirmed 2026-09-10)
non-breaking route. (`scope-document.md` success criterion "Consumers are not (affirmed 2026-09-10)
broken without cause"; the compatibility constraint in the intent statement, (affirmed 2026-09-10)
carried in `initiative-brief.md` § "Feasibility and Risk Highlights".) (affirmed 2026-09-10)
- NEVER build continuous integration or release and publication automation (affirmed 2026-09-10)
inside this initiative. (`scope-document.md` § "Out of Scope" [Q3]; both remain (affirmed 2026-09-10)
deferred to the named follow-on work "Release Automation and Test (affirmed 2026-09-10)
Infrastructure".) (affirmed 2026-09-10)
  - SUPERSEDED IN PART 2026-09-10: this rule also forbade building a test suite. (amended 2026-09-10)
  The maintainer lifted the test-suite half explicitly, in session, when asking (amended 2026-09-10)
  for "a clear npm audit and a set of automated tests". The test suite was (amended 2026-09-10)
  therefore built inside this initiative; CI and publication automation were (amended 2026-09-10)
  not, and stay deferred. (amended 2026-09-10)
## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS branch for a change that touches published behaviour or dependencies; (affirmed 2026-09-10)
documentation, configuration and internal cleanups go directly to `main`. (affirmed 2026-09-10)
(Interview Q1 and its follow-up Q12. Every item in this initiative's scope (affirmed 2026-09-10)
falls on the branch side of that line.) (affirmed 2026-09-10)
- ALWAYS merge a branch back as a merge commit, preserving the branch's (affirmed 2026-09-10)
individual commits. (Q13. This includes Construction Bolt branches. It is a (affirmed 2026-09-10)
deliberate, human-stated divergence from the framework default of squash-merge, (affirmed 2026-09-10)
affirmed as this team's practice rather than granted as an exception.) (affirmed 2026-09-10)
- ALWAYS write commit messages in Conventional Commits form from here on. (Q2. (affirmed 2026-09-10)
The bare version-number commits `npm version` generates are exempt.) (affirmed 2026-09-10)
- ALWAYS publish only from a clean checkout of the tagged commit. (Q6, taken on (affirmed 2026-09-10)
the evidence that the published `0.8.1` was built from a tree at least two (affirmed 2026-09-10)
commits ahead of its own tag. Pass/fail: the working tree is clean and `HEAD` (affirmed 2026-09-10)
is the tag being published.) (affirmed 2026-09-10)
- ALWAYS run `npm audit --omit=dev` on the final commit before publication and (affirmed 2026-09-10)
require it to report zero vulnerable packages; run the full-tree `npm audit` (affirmed 2026-09-10)
in the same pass and record both counts in the release notes, stating that the (affirmed 2026-09-10)
unit is npm's vulnerable-package count rather than an advisory count. (affirmed 2026-09-10)
(`scope-definition/scope-document.md` S6 [Q2] and its success criteria, made (affirmed 2026-09-10)
testable as the inception phase rules require; the dev/prod split and the unit (affirmed 2026-09-10)
correction come from the devsecops review.) (affirmed 2026-09-10)
- ALWAYS obtain the maintainer's explicit approval before publishing to the npm (affirmed 2026-09-11)
registry. Unconditional: it holds when the audit is clean, when every gate is (affirmed 2026-09-11)
green, and when publishing is the only step left in a workflow. No agent runs (affirmed 2026-09-11)
`npm publish` on its own initiative, and "the workflow says publish next" is (affirmed 2026-09-11)
not approval. Stated directly by the maintainer on 2026-09-11. It closes a real (affirmed 2026-09-11)
gap: the escalation rule below fires only "when a clean audit is not (affirmed 2026-09-11)
reachable", so with a clean audit nothing else gated the irreversible step. A (affirmed 2026-09-11)
publish to a public registry cannot be undone for downstream consumers. (affirmed 2026-09-11)
- ALWAYS return the release decision to the maintainer, before anything is (affirmed 2026-09-10)
published, when a clean audit is not reachable. (Escalation rule from the (affirmed 2026-09-10)
intent statement, carried in `approval-handoff/initiative-brief.md` § "Go / (affirmed 2026-09-10)
No-Go Recommendation" point 4 and in `scope-document.md` § "Risks".) (affirmed 2026-09-10)
- ALWAYS audit a replacement linter's own dependency tree before adopting it, (affirmed 2026-09-10)
and return the choice to the maintainer if it introduces advisories. (Q9, (affirmed 2026-09-10)
taken on the evidence that removing `tslint` and `typedoc` clears five of the (affirmed 2026-09-10)
eight vulnerable packages and a replacement could reopen an unknown number in (affirmed 2026-09-10)
the same commit.) (affirmed 2026-09-10)
- ALWAYS declare a supported Node range in the `engines` field rather than an (affirmed 2026-09-10)
exact version. (`scope-document.md` S5 [Q4], and its success criterion "The (affirmed 2026-09-10)
declared runtime is a supported range"; the current value is the exact, (affirmed 2026-09-10)
end-of-life `"17.1"`.) (affirmed 2026-09-10)
- ALWAYS re-approve an input that changes after the gate that approved it. (affirmed 2026-09-10)
(`Change Control: strict`, set explicitly by the maintainer and recorded in (affirmed 2026-09-10)
`aidlc-state.md`; `change_control: strict` in the active scope file, on the (affirmed 2026-09-10)
stated ground that a publish to a public registry is irreversible for (affirmed 2026-09-10)
downstream consumers.) (affirmed 2026-09-10)
## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- When a stage's evidence and reviews produce far more candidate questions than can usefully be asked, use the target artifact's own sections as the organising frame and admit only questions the workspace genuinely cannot answer and that change what lands in durable memory; drop anything the evidence already settled rather than asking for confirmation. (learned 2026-09-10) <!-- cid:260910-release-hardening:practices-discovery:4e0850346bdd7d8648b89c8b5c1313d80ed000f5dbeec6fb4ed108718f557ec8 -->
- Before writing a requirement or design that a promoted rule governs, read that rule back from the active rule bundle rather than drafting only from the upstream artifacts; a rule affirmed in an earlier stage of the same workflow is easy to contradict precisely because it feels already known. (learned 2026-09-10) <!-- cid:260910-release-hardening:requirements-analysis:38b6b783b90745451b24d62495c9d914eae486882667ff810ecd4970d7c81496 -->
- When a dependency advisory states a vulnerable range, measure a candidate version against a fresh install tree rather than trusting the range boundary; the stated upper bound may name a release that does not exist, and the measurement also reveals which transitive advisories the upgrade closes with it. (learned 2026-09-10) <!-- cid:260910-release-hardening:requirements-analysis:52944022a6b390dde23d28e0f8bc0785725b6ec9804f00f85e8a5bf78d56b263 -->
