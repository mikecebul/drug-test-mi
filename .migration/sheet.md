# sheet

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/sheet.tsx` now composes Base UI Dialog parts, maps Overlay to Backdrop and Content to Popup, and replaces Radix slide keyframes with Base UI starting/ending transition styles for every side. `src/globals/Header/MobileNav.tsx` and `src/components/data-table.tsx` now pass trigger and close buttons through `render`. `grep -n "radix-ui\|@radix-ui" src/components/ui/sheet.tsx` is clean.

## Left alone

Vaul-based `src/components/ui/drawer.tsx` remains intentionally untouched; it is a separate third-party primitive.

## Behavior changes

Base UI consolidates outside and escape dismissal interception into Root `onOpenChange` event details; no sheet consumer used the removed callbacks.

## Verify by hand

Open the mobile navigation and data-table detail sheet, confirm the correct slide direction, focus trapping, Escape/close behavior, backdrop, and focus return to the trigger.
