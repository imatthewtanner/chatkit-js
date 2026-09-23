# AGENTS.md

## Project

Fork of OpenAI's [chatkit-js](https://github.com/openai/chatkit-js) — ESM pnpm monorepo publishing ChatKit UI widgets.

Workspace packages:

- `packages/chatkit` (`@openai/chatkit`): **types-only** package for the `<openai-chatkit>` web component. No runtime code, build, tests, or lint — just `types/` checked by `tsc`.
- `packages/chatkit-react` (`@openai/chatkit-react`): React bindings (the real code). `src/` holds `ChatKit.tsx`, `useChatKit.ts`, etc. Built with `tsup` (esm+cjs+dts), tested with `vitest`.
- `packages/docs` (private): Astro/Starlight docs site; content lives in `src/content/docs/*.mdx`.

Repo root also holds `opencode-api.js` — a dependency-free Node script (not part of the workspace) that drives the local OpenCode service over its raw HTTP API. See the README section "OpenCode API client".

## Toolchain

- **pnpm is the package manager — never npm.** `pnpm-lock.yaml` is the source of truth. The repo pins `packageManager: pnpm@10.11.0`; pnpm isn't preinstalled, so use `corepack enable` (then `pnpm`) or `corepack pnpm <cmd>`.
- CI runs Node 22 (`ci.yml`); the release job uses 24 — match locally with Node 22.
- ESLint flat config is per-package (`packages/*/eslint.config.js`); there is no root config.
- Prettier: `singleQuote: true`, `tabWidth: 2`; `format:check` gates CI.

## Commands

- Full local gate (mirrors CI order): `pnpm check` — prettier `--check` → lint → types → test.
- Build all: `pnpm build`; reformat tree: `pnpm format`.
- Scoped to one package: `pnpm -F @openai/chatkit-react test|lint|types|build`.
- Docs dev server: `pnpm dev:docs` (Astro).

## Gotchas

- **`pnpm-workspace.yaml` is broken — do not install until fixed.** It was overwritten with a Python/FastAPI snippet (line 1 starts `from fastapi import FastAPI`) and no longer declares `packages: ['packages/*']`, which breaks `workspace:*` resolution for all packages. Restore it to `packages: ['packages/*']` before any `pnpm install`.
- `package-lock.json` at the repo root is **tracked but should not be** — it was created by an accidental `npm install` and committed in `a5837f6`. This is a pnpm repo; the lockfile of truth is `pnpm-lock.yaml`. Remove `package-lock.json` and never run `npm install` here (use `corepack pnpm`).
- **Commit email:** history on `main` uses author/committer `130527893+imatthewtanner@users.noreply.github.com`. GitHub blocks pushes containing `imatthewtanner@icloud.com` (`GH007` email-privacy policy) — configure that noreply address as `user.email` before committing, or the push will be rejected.
- `@openai/chatkit` has no `build`/`test`/`lint` scripts — scoped runs over it are no-ops; don't expect a `dist/`.
- Tests are colocated as `src/*.test.ts` (vitest) and exist only in `chatkit-react`.
- Releases run through changesets (`.changeset/`): add one for any user-facing change; `release.yml` versions and publishes on push to `main`.
