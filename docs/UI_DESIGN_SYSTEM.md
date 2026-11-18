# UI design system

The frontend uses plain CSS with design tokens. There is no UI framework and no icon package.

## Files

| File | Contents |
| --- | --- |
| `frontend/src/styles/tokens.css` | Every colour, type size, spacing step, radius, shadow, z-index and layout width |
| `frontend/src/styles/base.css` | Reset, typography, and layout helpers (`stack`, `cluster`, `spread`, `grid-2/3/4`) |
| `frontend/src/styles/ui.css` | Reusable components (buttons, cards, fields, badges, modal, menu, tooltip, toasts, tabs, segmented control, tables, states) |
| `frontend/src/styles/app.css` | App shell (sidebar, mobile top bar and tab bar) and page layouts |

## Palette

The colours come from the logo:

- **Graphite neutrals** for surfaces, borders and text.
- **Orange** (`--accent`, `--accent-strong`) for the main call to action ("Log service", "New reminder", "Send reminder") and for active navigation. Use it sparingly.
- **Steel blue** (`--link`, `--info`) for links and informational accents.
- **Status colours** (`--ok`, `--warn`, `--danger`, `--unknown`, each with `-bg`, `-border` and `-fill` variants). Status is always shown with an icon and text, never colour alone.

Never hard-code a hex value in a component; add a token instead.

## Components (`frontend/src/components/ui`)

- `Button`: variants `primary` (ink), `accent` (orange), `secondary`, `ghost`, `danger`, `danger-ghost`. Sizes `sm` and `lg`. Add `className="btn--icon"` for square icon-only buttons; these always need an `aria-label`, and `data-tooltip` is recommended.
- `StatCard`: KPI tile with label, icon, value, hint and an optional action.
- `Menu`, `MenuItem`, `MenuSeparator`, `MenuLabel`: keyboard-accessible dropdown. Use it for secondary or destructive actions.
- `Segmented`: compact filter switcher with counts.
- `Tabs`: accessible tabs with an optional `count`.
- `Input`, `Select`, `Textarea`: support `icon` (leading icon), `hideLabel` (label kept for screen readers) and `fieldClassName`. `Switch` is an accessible on/off control.
- `Modal` and `ConfirmDialog`: dialogs with a header and close button. They become bottom sheets on phones.
- `EmptyState` (`compact` for use inside cards), `ErrorState`, `Skeleton`, `StatusPill`, `PageHeader` (`back`, `leading`, `meta`, `actions`).

## Patterns

- Tables use `.table`. Add `.table--stack` plus `data-label` on cells, and `.table__primary` on the first cell, so rows turn into cards below 640px.
- Card headers use `.card__header` with `.card__title` and `.card__subtitle`. Inside `.card--flush`, the header gets a bottom border automatically.
- Lists that link somewhere use `.row-list` and `.row-link`.
- Breakpoints: 860px (sidebar becomes top bar + bottom tab bar) and 640px (phone layouts).

## Languages (Hebrew default, English)

- `src/i18n/index.js` holds the language state. Hebrew (`he`, right to left) is the default; the choice is saved in `localStorage["lang"]` and mirrored onto `<html lang dir>`. The app tree remounts on a switch.
- Write UI text in English and wrap it: `t("Log service")`, `t("Due {date}", { date })`, `tp(n, "1 service", "{n} services")`. The English string is the key; add the Hebrew translation to `src/i18n/he.js`. `src/i18n/i18n.test.js` fails if a `t()`/`tp()` string has no translation or a translation drops a `{placeholder}`.
- Keep stored data language-neutral: service titles are saved with the English treatment label and translated on display (`displayTitle`, `treatmentLabel`, `itemLabel`). Backend data-check warnings are translated by `code` (`lib/warnings.js`). Other server error messages are shown as the server sends them (English).
- Layout CSS uses logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`) so it mirrors in RTL. Add `className="icon--dir"` to icons that point a direction (back, chevrons, arrows) so they flip in Hebrew. Wrap mixed number strings such as "5 / 6" in `dir="ltr"`.
- The language can be switched from the account menu, the sign-in pages and Profile → Language.
