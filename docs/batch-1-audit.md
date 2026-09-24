# Batch 1 architecture audit

## Previous state

- `apps/app` was a React DOM application built with Vite.
- It used HTML elements, browser globals, CSS, and a responsive web layout.
- Expo, React Native, and Expo Router were absent, so it could not produce an Android or iOS application.
- The root used npm workspaces.

## Migration decision

The disposable web UI was removed rather than presented as mobile. Reusable legal vocabulary, mock-data concepts, navy/gold direction, and repository-boundary ideas were retained and rebuilt using React Native primitives.

The primary application is now `apps/mobile`. `apps/web` and `apps/api` are intentionally reserved, not implemented. pnpm and Turborepo manage the monorepo.

## Execution environment finding

Dependency installation was attempted through the configured official registry (`https://registry.npmjs.org/`) without weakening TLS or changing to an untrusted registry. The environment proxy returned HTTP 403, so package-driven lint, typecheck, tests, Metro startup, and native runtime verification remain blocked in this environment. This is an execution-environment limitation, not a successful verification.
