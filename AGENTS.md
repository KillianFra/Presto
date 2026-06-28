# Repository Guidelines

## Project Structure & Module Organization

This repository is centered on the Presto REST API in `backend/`. Source code lives in `backend/src`, with the Express composition in `app.ts` and the runtime entry point in `server.ts`. Keep HTTP routing in `backend/src/routes`; place domain behavior and support code under `backend/src/modules/<domain>`, such as `auth`, `projects`, `credits`, or `transformations`. Shared infrastructure belongs in `config`, `lib`, `middleware`, and `types`. Prisma schema and migrations live in `backend/prisma`, and tests live in `backend/tests/*.test.ts`. Root-level `compose.yaml` runs local Postgres, Redis, migrations, and the backend container.

## Build, Test, and Development Commands

Run backend commands from `backend/`.

- `rtk pnpm install`: install dependencies with the locked pnpm version.
- `rtk pnpm run dev`: start the API with `tsx watch src/server.ts`.
- `rtk pnpm test`: run Node test files through `tsx --test`.
- `rtk pnpm run typecheck`: typecheck source and tests.
- `rtk pnpm run build`: compile TypeScript to `dist/`.
- `rtk pnpm run db:generate` / `rtk pnpm run db:validate`: generate Prisma client and validate the schema.
- `rtk docker compose -f ../compose.yaml up --build`: run the local stack from `backend/`.

## Coding Style & Naming Conventions

Use strict TypeScript with ES modules and explicit `.js` import suffixes for local runtime imports. Follow the existing style: two-space indentation, single quotes, descriptive factory names such as `createProjectService`, and domain filenames like `project.service.ts`, `project.types.ts`, and `project.errors.ts`. Route files should be named `<domain>.routes.ts` and should delegate business logic to modules.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`. Name test files after the behavior under test, for example `auth.routes.test.ts` or `project.service.test.ts`. Prefer exercising public route/service APIs and inject test config or fakes instead of relying on production environment variables. Run `rtk pnpm test` and `rtk pnpm run typecheck` before opening a PR.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit style, for example `feat(auth): implement authentication system`. Keep commits scoped and imperative: `fix(projects): validate upload size`. PRs should describe the behavior change, list validation commands run, link related issues, and include screenshots only for user-visible UI changes.

## Security & Configuration Tips

Copy `backend/.env.example` for local configuration and never commit real Supabase, Stripe, Redis, or database secrets. Keep Prisma migrations in sync with schema changes, and validate Docker Compose when changing root deployment files.
