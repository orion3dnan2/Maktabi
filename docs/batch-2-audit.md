# Batch 2 completion report — Steps 6–10

## 1. Implemented steps

- **6 — Client List:** repository-backed, virtualized Arabic RTL list with normalized name/phone search, client-type picker, active-matter counts, remaining fees, last activity, empty/loading/error states and pull-to-refresh.
- **7 — Create/Edit Client:** shared native fields for individuals and organizations, Arabic required/contact validation, repository saves, visible save errors, cancel and a navigation-aware discard dialog. Organization contact/email/address are required; individual email/ID/address/notes are optional.
- **8 — Client Profile:** overview, matters, accounts, documents, receipts and activity; primary contact; total/active matters; agreed/paid/remaining fees; separate trust and expenses; recent receipt/document fixtures. Edit, create matter, WhatsApp and call prototype actions are available.
- **9 — Matter List:** all nine matter types, reference/title/primary party/authority/status/stage/next date; Arabic search; native modal status/type/authority filters; newest/reference/next-date ordering; loading/error/empty/refresh support.
- **10 — Create Matter:** six stages: basics, clients/parties, type-specific fields, authority, dates/notes, review/create. Supports additional registered clients and unregistered opponents/witnesses/other parties. Profile entry preselects its client. Saves refresh both lists and profile activity.

## 2. Screens and routes

| Route | Screen |
| --- | --- |
| `/(tabs)/clients` | Client list |
| `/clients/new` | New client |
| `/clients/[id]` | Client profile |
| `/clients/[id]/edit` | Edit client |
| `/(tabs)/matters` | Matter list |
| `/matters/new` | New matter; optional `clientId` preselection |

Dashboard quick actions now open the new-client and new-matter screens. The five tabs remain الرئيسية، الملفات، التقويم، العملاء، المزيد.

## 3. Domain and repositories

`Client` adds WhatsApp, contact person, registration, address and notes. `Matter` replaces the single `primaryClientId` property with `parties: MatterParty[]`, and adds notes, type-specific details and optional current-stage text. The existing `MatterParty` identity, client link, role and primary flag remain the relationship model. Validation requires exactly one primary registered client, permits multiple additional parties, and checks party/matter linkage. Existing dashboard/domain finance entities remain intact.

`ClientRepository` saves and retrieves session-local records. `MatterRepository` adds office listing, queries every party link for client matters, rejects unknown/cross-office clients and duplicate office references, and returns defensive copies. Client edits update linked party names. A separate profile repository supplies fictional SDG minor-unit fee, trust and expense summaries plus document/receipt/activity records. New clients start with zero finances and no fabricated documents/receipts. These are mock summaries, not a ledger implementation.

The factory `createMockRepositories()` provides isolated repositories for tests; exported singleton instances share state across screens. App reload restores fixtures. No backend, durable storage or sync was added.

## 4. UX decisions

Native React Native/Expo primitives throughout. Existing navy/gold/warm-white tokens are reused. `packages/ui` now exports shared choice modals, form page, discard dialog, text styles and existing primitives through a barrel without circular component imports. Inputs inherit accessible labels. Forms accommodate the keyboard and lists use FlatList; active counts are precomputed instead of scanning matters for every rendered row.

Arabic matching normalizes diacritics, tatweel, alef variants, final ya and Arabic digits. Filters use modal pickers instead of wide desktop controls. Matter-specific fields are optional; dates, primary party, reference, title and authority are validated. Switching matter type explicitly clears the previous type's fields, with a visible explanation. No legal rules or deadlines are inferred.

## 5. Verification results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| `pnpm lint` | **PASS** | No errors or warnings in the final run |
| `pnpm typecheck` | **PASS** | All six packages |
| `pnpm test` | **PASS** | 36 tests: 28 domain + 8 repository |
| `pnpm --filter @maktabi/mobile start` | **BLOCKED** | Port 8081 already occupied; non-interactive command could not approve another port |
| `pnpm --filter @maktabi/mobile start --port 8082` | **PASS** | Metro ready at localhost:8082 |
| `pnpm --filter @maktabi/mobile exec expo export --platform android --output-dir dist-android` | **PASS** | Final Android Hermes bundle exported, 1067 modules |
| Expo browser-preview interaction check | **PASS** | Arabic client search, empty required-field submission, create/edit client, refreshed profile, profile → new matter preselection, additional party, labour fields, review/create, refreshed matter list, closed-status filter, keep/discard draft navigation |
| Physical Android/iOS interaction check | **BLOCKED** | No device/emulator interaction was available in this run; browser preview and native bundling do not establish device behavior |

Tests cover client validation, Arabic search/type filtering, create/update/isolation, party rename propagation, one-to-many and multi-party relationships, all nine matter types, mandatory primary behavior, invalid dates/labour chronology, combined matter filters/order, duplicate references, unknown clients, office boundaries and separated financial fixtures.

Initial dependency installation encountered a release-age policy rejection for the pre-existing Rollup 4.63.5 lockfile entry, published on the day of this run. Rollup is pinned to the preceding 4.63.4 release (published September 19); installation then completed. SSL/security settings were not weakened. React Navigation is now an explicit dependency for the existing navigation stack's focus and removal hooks.

## 6. Known issues and deliberate limits

- Mock persistence lasts only for the running app session; reload resets changes. Every working screen says so.
- Phone and WhatsApp actions are previews. Documents and receipts are descriptive mock records, not downloadable files or generated financial instruments.
- Existing dashboard aggregate fixtures remain independent of the new repository lists; dashboard totals are not live accounting values.
- Expo warns that the existing React Native 0.81.4 should be 0.81.5 for its installed Expo patch. This batch preserves the existing runtime version; Android export succeeded despite the warning.
- Native RTL rendering, keyboard behavior, screen-reader behavior and back gestures still need device acceptance testing. Error-state UI exists, but backend failures are not part of this mock phase.
- Turborepo emits its existing “no output files” warning for test tasks; tests pass.
- No Matter Details or procedural Workflow screens were implemented.

## 7. How to review

1. Install with `pnpm install --frozen-lockfile`. Start with `pnpm --filter @maktabi/mobile start` (or add `--port 8082` when 8081 is occupied). Open through Expo on a compatible device. Demo login accepts non-empty fictional credentials; do not enter real information.
2. **Client list:** choose العملاء. Search `امجد` to match `أمجد`; try organization filtering and a nonexistent name. Pull to refresh. The fourth seed client has no matters or finances.
3. **New client:** use عميل جديد on the list or dashboard. Submit empty fields to see Arabic validation, then fill fictional name/phone/WhatsApp and save. Switch to organization to review its contact/email/address requirements. Start editing and cancel to exercise both discard-dialog actions.
4. **Edit client:** open its profile, choose تعديل العميل, update name/notes and save. Confirm the profile and linked matter party labels update.
5. **Client profile:** open a seeded client and choose each of the six sections. Inspect agreed/paid/remaining fees, trust and expenses separately; confirm receipt/document fixtures and prototype actions. Compare with a newly created client's zero/empty state.
6. **Matter list:** choose الملفات. Search by office reference or an Arabic client name. Combine status, type and authority filters. Try all three sort modes and an empty combination.
7. **New matter:** launch from dashboard/list and also from a client profile. Confirm profile preselection. Supply a unique reference/title, primary client and optional additional parties; examine all dynamic type fields; enter authority and opening date; review and create. Confirm the new row and its client profile matter count. Try duplicate reference, missing primary, invalid calendar date and reversed labour dates. No matter-detail navigation is expected in Batch 2.

## 8. Git and review

Work is on `codex/batch-2-clients-matters`, branched from `main`. The accompanying commit and draft PR contain only Batch 2 and supporting tests/documentation. The completion response records the exact commit and final working-tree status. PR target is `main`; merging requires product-owner review.

## 9. Proposed next batch — not implemented

11. Matter Overview
12. Matter Header/Sections
13. Workflow Timeline
14. Workflow Stage Detail
15. Criminal Workflow Prototype

## 10. Stop

Batch 2 ends here. Do not begin Batch 3 or merge the PR without explicit approval.
