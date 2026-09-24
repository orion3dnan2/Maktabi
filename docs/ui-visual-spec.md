# Maktabi — UI visual spec (visual lock)

Source of truth: the five reference screenshots supplied by the product owner (Login, Dashboard, Matter list, Matter details, Clients & appointments). The two `chatgpt.com/s/...` share links could not be opened from the build environment; this spec was extracted from the exported screenshots of the same designs.

All values below are implemented as tokens in `packages/ui/src/theme.ts`. Screens must use tokens, never ad-hoc values.

## 1. Page anatomy

Every primary screen follows the same three layers:

1. **Hero** — full-bleed dark navy area under the status bar (≈ 230–260 pt tall on the reference iPhone). It contains, in RTL:
   - top **start** (right): circular gold-ring emblem (scales of justice), 64 pt;
   - top **end** (left): round translucent icon button (notifications, with a small gold dot);
   - large white title (26–28 pt, bold) and a muted white subtitle (14 pt), right-aligned;
   - a warm decorative scale-of-justice motif on the end (left) side. The reference uses a photograph (scales + law books); until a licensed asset is supplied the motif is drawn with a large faded icon over a navy gradient.
2. **Overlap content** — the first cards/search bar start *inside* the bottom edge of the hero (≈ 40 pt overlap), on a warm off-white canvas.
3. **Bottom navigation** — dark navy bar, five items, a raised gold circular centre item, gold active label with a short gold underline.

## 2. Colour

| Token | Value | Use |
|---|---|---|
| `navy950` | `#081628` | hero base, tab bar, dark metric cards |
| `navy900` | `#0D213A` | hero gradient top, dark buttons, headings on light |
| `navy800` | `#16304F` | dark card surface, icon discs on dark |
| `navy700` | `#23405F` | borders on dark cards |
| `gold700` | `#8E6A2B` | gold text on light (AA contrast) |
| `gold600` | `#A9803F` | gold gradient end, active icons |
| `gold500` | `#C9A45C` | gold gradient start, emblem ring, dots |
| `gold300` | `#E4CD98` | selected chip on dark |
| `gold100` | `#F6ECD6` | soft gold icon discs, badges |
| `canvas` | `#F3EFE7` | page background |
| `surface` | `#FFFDF9` | cards (warm white) |
| `surfaceMuted` | `#F8F4EC` | inner panels (e.g. time column) |
| `ink` | `#0F1E33` | primary text |
| `muted` | `#6F7680` | secondary text |
| `onDarkMuted` | `#B9C2CE` | secondary text on navy |
| `border` | `#E9E2D5` | card borders, dividers |
| `success` / `successSoft` | `#2E7D4F` / `#E4F3E9` | "active", "confirmed" |
| `info` / `infoSoft` | `#2F6FD6` / `#E7EFFC` | "in progress", meetings |
| `warning` / `warningSoft` | `#A66A18` / `#FBF0DC` | "postponed" |
| `danger` / `dangerSoft` | `#C23B36` / `#FBE7E6` | urgent, closed, errors |
| `disabled` | `#C9CDD2` | disabled controls |

Gradients: hero `navy900 → navy950` (top → bottom); primary button `#D9B872 → gold600` (start → end).

Status chips always pair a soft background with the strong foreground of the same family.

## 3. Typography

Font: **Noto Sans Arabic** (bundled via `@expo-google-fonts/noto-sans-arabic`, weights 400/500/700). The references use a clean humanist Naskh-style sans with a round, low-contrast stroke that matches Noto Sans Arabic more closely than Kufi.

| Role | Size / line height | Weight |
|---|---|---|
| `display` (hero title) | 27 / 42 | Bold |
| `title` (screen/card title, login title) | 22 / 34 | Bold |
| `section` (card section heading) | 17 / 28 | Bold |
| `bodyStrong` (list titles) | 15 / 24 | Medium |
| `body` | 14 / 23 | Regular |
| `label` (field labels, meta) | 13 / 21 | Regular |
| `caption` (chips, tab labels, timestamps) | 12 / 19 | Medium |
| `metric` (big numbers) | 28 / 36 | Bold |

Minimum text size is 12 pt. Numbers use the same family; Latin digits are acceptable, as in the references.

## 4. Spacing, radius, elevation

- Spacing scale: 4, 8, 12, 16, 20, 24, 32.
- Screen gutter: 16. Gap between cards: 12. Inner card padding: 16.
- Hero overlap: 40.
- Radius: 8 (chips inner), 12 (inputs, icon discs), 16 (cards), 20 (sheets, hero-overlap cards), full (pills, avatars, emblem).
- Elevation: one soft card shadow (navy, 8% opacity, y = 4, blur 14) and a stronger "raised" shadow for the centre tab and primary button.
- Touch targets ≥ 48 pt; the icon buttons in the hero are 44 pt with 10 pt hit slop.
- Icon sizes: 16 (inline meta), 20 (list/action), 24 (tab), 28 (hero emblem glyph).

## 5. Components

- **ScreenHero**: see §1. Props: title, subtitle, optional back action, optional trailing action.
- **Emblem**: gold ring, navy fill, gold scales glyph; sizes 64 (hero) and 104 (login/splash).
- **Card**: warm white, radius 16, 1 px border, soft shadow. Header row = gold-outline icon + bold title on the start side, "عرض الكل ‹" link on the end side.
- **MetricCard**: two variants, light and dark, arranged diagonally in a 2 × 2 grid (dark at top-start and bottom-end). Content: label, big number, caption, round icon disc on the end side, small chevron at bottom-end.
- **TimelineRow** (schedule): status chip at start, icon, title + meta, then a vertical rail with a coloured dot, then a time column (time + date) on the end side inside a muted panel.
- **AlertRow**: round soft icon at start, title + detail, relative time with coloured dot at end.
- **SearchBar**: white, radius 14, magnifier at start, placeholder muted.
- **FilterChip**: pill; selected = gold soft fill with navy text, unselected = transparent with light border on dark.
- **StatusBadge**: pill, soft fill, optional leading dot/icon.
- **TextField**: 56 pt, radius 14, 1 px border, leading icon at start, optional trailing adornment (eye); label is carried as accessibility label and placeholder (the references show no visible label above fields).
- **Checkbox**: 22 pt gold square with white check.
- **PrimaryButton**: pill, gold gradient, white bold label centred, circular translucent arrow disc at the end side.
- **BottomNavigation**: see §1. Labels 12 pt; inactive `onDarkMuted`, active `gold500`, 24 × 3 gold underline under the active label.

## 6. RTL rules

- Arabic is the design language, not a mirror of an English layout. Start = right.
- Horizontal rows use the `rtl.row` token, which resolves to `row` when the native layout is already RTL and `row-reverse` otherwise. That keeps the right-to-left visual order correct whether or not `I18nManager` RTL is active (first launch, Expo Go, web).
- Text alignment uses `rtl.text` (`textAlign` resolved the same way, because React Native swaps `left`/`right` under native RTL on both Android and iOS) and `writingDirection: 'rtl'`.
- Chevrons pointing "forward" in Arabic point left (`chevron-back` glyph under LTR layout).
- Times and dates are formatted with `Intl` in `ar` locale and the office time zone (`Africa/Khartoum`), never hard-coded strings.

## 7. Honesty rules kept from the product brief

- No claim of encryption or biometric login is displayed until it exists; the login footer shows the demo-data disclaimer instead.
- All sample data stays labelled as sample data.
