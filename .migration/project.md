# Project migration

2026-07-09, whole-project transformation-engine migration for legacy shadcn `default` style, completed successfully.

## Dependency swap

- Kept `@base-ui/react` and verified the installed version is 1.4.1.
- Removed all 20 direct `@radix-ui/react-*` dependencies from `package.json` and regenerated `pnpm-lock.yaml` with pnpm 11.1.1.
- Confirmed there are no Radix imports in `src/components/ui` or elsewhere under `src`.

## Wrapper migration

Migrated 24 Radix-backed wrappers: avatar, badge, breadcrumb, button-group, button, checkbox, dialog, dropdown-menu, file-upload, label, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, slider, tabs, toggle-group, toggle, and tooltip. Each component has a self-contained report in `.migration/<component>.md`.

## Consumer sweep

- Replaced Base-migrated `asChild` call sites with `render`; remaining `asChild` usages belong only to the intentionally untouched Vaul drawer.
- Converted Select consumers to Base UI's nullable callback signatures, `items` label model, grouped item composition, and Positioner collision props.
- Converted dropdown item `onSelect` handlers to `onClick`, preserving prevented-close behavior with `closeOnClick={false}`.
- Updated Radix state hooks and CSS variables to Base UI presence attributes and variables.

## Left alone

Vaul drawer, cmdk command, Sonner, react-day-picker calendar, Recharts chart, and other non-Radix wrappers were intentionally untouched, as required by the migration skill.

## Verification

- Baseline and final `pnpm exec tsc --noEmit`: passed.
- `pnpm test:integration:ci`: 37 files and 346 tests passed.
- `pnpm lint`: passed with 316 existing warnings and no errors. Targeted migrated-wrapper lint has only the pre-existing file-upload input mutation and sidebar skeleton randomness warnings.
- `pnpm build`: migrations completed, Next.js production compilation succeeded, TypeScript completed, and `.next/BUILD_ID` was produced.
- Final source scan: 0 wrappers remain on Radix.
- In-app Browser QA exercised all 24 migrated wrappers on desktop and mobile, including keyboard/focus behavior, overlays, scrolling, navigation, and production admin workflows. Two migration regressions were fixed and re-tested; the full matrix is in `.migration/browser-qa.md`.
- The production mobile header sheet was verified at 390×844, and its icon-only trigger now has an accessible name.

## shadcn configuration note

The project uses legacy `components.json` style `default`, which has no `base-default` registry counterpart. Per the migration skill, it was not switched to a modern `base-*` preset because that would restyle the application. Consequently, future `shadcn add` commands may still offer Radix variants; use Base registry variants explicitly or choose a modern Base preset in a separate, reviewed design-system migration. The network-backed shadcn CLI context/docs command was blocked by the environment, so installed Base UI 1.4.1 type definitions and the two local skills were used as the authoritative API references.
