# Arabic legal-office UI refresh

The supplied mobile references define the navy, metallic gold and ivory design system. The existing Expo Router screens and in-memory repositories are retained; displayed totals reflect repository data rather than hard-coded screenshot totals.

## Implementation

- Shared photo-backed legal hero, Tajawal typography, layered ivory cards, gold gradients, status badges and readable RTL timelines.
- Responsive login, dashboard, cases, case details and clients screens.
- Shared fixed bottom navigation, active indicator and spring-animated center control.
- Appointments list with a week filter; More menu links to existing creation forms.
- Search, case filters, detail navigation and existing client/matter forms remain connected to the mock repositories.
- The bundled background works offline. No new native dependency was added.

## Validation

- TypeScript: passed.
- Existing repository tests: 8 passed.
- Expo exports: web, iOS and Android passed.
- Browser review: 390 × 844; login, dashboard, cases, case details, clients, appointments and More.
- Browser interactions: demo login, case status filtering, case-number search, detail opening, bottom navigation and appointments filtering.
- Physical-device/Expo Go runtime checks have not been performed.

The UI validation above predates the workflow implementation. Authentication now opens a local encrypted office vault using a telephone number and password, and repository writes persist locally. Biometrics, communications, server synchronization and production team access remain incomplete. See `requirements-audit-2026-09-27.md` for the current feature status and validation limits. The reference screenshots' names, financial amounts and summary counts are examples, not a replacement database.

## Background asset

Path: `apps/mobile/assets/legal-office.png`
Generated with the built-in image generation tool. Final prompt:

> Create a photorealistic luxury law office background asset for an Arabic mobile app, landscape 3:2 composition. Antique brass scales of justice prominently on the LEFT third, resting on dark leather law books on a polished wood desk. Softly blurred tall law library bookshelves behind. Right 60 percent of image is very dark navy negative space (#061B2D) with faint library texture for white UI text overlay. Elegant warm metallic gold highlights, cinematic low key lighting, subtle depth of field, realistic brass and leather, premium professional atmosphere. No text, no letters, no logos, no UI, no phone frame. Image fills entire canvas.

## Run

`pnpm --filter @maktabi/mobile start`

For web: `pnpm --filter @maktabi/mobile web --port 8082`
