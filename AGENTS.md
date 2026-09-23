# AGENTS.md

## Project

Fork of OpenAI's [chatkit-js](https://github.com/openai/chatkit-js) — ESM pnpm monorepo publishing ChatKit UI widgets.

Workspace packages:
- `packages/chatkit` (`@openai/chatkit`): **types-only** package for the `<openai-chatkit>` web component. No runtime code, build, tests, or lint — just `types/` checked by `tsc`.
- `packages/chatkit-react` (`@openai/chatkit-react`): React bindings (the real code). `src/` holds `ChatKit.tsx`, `useChatKit.ts`, etc. Built with `tsup` (esm+cjs+dts), tested with `vitest`.
- `packages/docs` (private): Astro/Starlight docs site; content lives in `src/content/docs/*.mdx`.

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

- Working tree has uncommitted local edits — always check `git status` first. Currently `pnpm-workspace.yaml` was overwritten with a Python snippet and no longer declares `packages: ['packages/*']`, which breaks `workspace:*` resolution. A stray untracked `package-lock.json` exists too; don't install or commit with npm.
- `@openai/chatkit` has no `build`/`test`/`lint` scripts — scoped runs over it are no-ops; don't expect a `dist/`.
- Tests are colocated as `src/*.test.ts` (vitest) and exist only in `chatkit-react`.
- Releases run through changesets (`.changeset/`): add one for any user-facing change; `release.yml` versions and publishes on push to `main`.