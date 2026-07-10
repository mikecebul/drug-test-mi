# toggle

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/toggle.tsx` now uses the callable Base UI Toggle primitive and maps Radix's `data-state="on"` styling to `data-pressed`. `grep -n "radix-ui\|@radix-ui" src/components/ui/toggle.tsx` is clean.

## Left alone

Toggle consumers and visual variants were left unchanged because they use props shared by both primitive implementations.

## Behavior changes

None.

## Verify by hand

Toggle the control with pointer and keyboard, then confirm pressed, hover, focus, and disabled states retain their styling.
