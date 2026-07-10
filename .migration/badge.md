# badge

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/badge.tsx` replaces Radix Slot polymorphism with Base UI `useRender` and `mergeProps`, exposing `render` while preserving all variants and default span rendering. `grep -n "radix-ui\|@radix-ui" src/components/ui/badge.tsx` is clean.

## Left alone

Badge consumers were left unchanged because none used the former `asChild` prop.

## Behavior changes

None.

## Verify by hand

Inspect status badges across the dashboard and wizard, checking variant colors, inline icons, focus styling on rendered links, and text truncation.
