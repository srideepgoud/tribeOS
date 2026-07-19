# TribeOS Dependency Policy

**Status:** Approved v1.0

**Purpose:** Prevent dependency sprawl. Defines approved languages, toolchain versions, package managers, and the rules for adding new dependencies.

---

## Approved Languages

| Area | Language |
| --- | --- |
| Backend | Python |
| Frontend | TypeScript |

No other languages are introduced without an ADR.

---

## Supported Toolchain Versions

| Tool | Version |
| --- | --- |
| Python | 3.12 |
| Node.js | 22 LTS |
| pnpm | 10.x |
| uv | current stable |

- Node version is pinned via `.nvmrc`; Python via `.python-version`.
- `pnpm` is pinned via the root `package.json` `packageManager` field.
- CI uses these exact versions to avoid "works on my machine" drift.

---

## Package Managers

| Ecosystem | Manager | Notes |
| --- | --- | --- |
| Python | **uv** | The only Python package manager. Do not use `pip`, `poetry`, or `conda` directly. |
| JavaScript / TypeScript | **pnpm** | The only JS package manager. Do not use `npm` or `yarn`. |

Lockfiles (`uv.lock`, `pnpm-lock.yaml`) are committed and authoritative.

---

## Rules for Adding a New Dependency

Before adding any dependency:

1. **Justify it.** Every new dependency must have a documented reason (in the PR description or the relevant milestone plan).
2. **No duplication.** Do not add a library that duplicates functionality already available in the standard library or an existing dependency.
3. **Add it in the milestone that first uses it.** Do not pre-install "we might need it later" packages. Unused dependencies are not allowed.
4. **Prefer stdlib and existing tools.** Reach for a new dependency only when it provides clear, non-trivial value.
5. **Pin via lockfiles.** Never rely on floating latest.
6. **Assess maintenance & security.** Prefer well-maintained, widely-used packages; avoid abandoned or single-maintainer-risk libraries for critical paths.
7. **Significant dependencies may require an ADR.** Anything that shapes architecture (a new framework, ORM, state manager, etc.) is recorded as an ADR.

---

## Removing Dependencies

If a dependency becomes unused, remove it. The dependency graph should reflect only what the codebase actually exercises.

---

## Status

**APPROVED**

This policy is authoritative. All dependency changes must comply.
