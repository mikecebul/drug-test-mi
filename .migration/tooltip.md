# tooltip

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/tooltip.tsx` now uses Base UI Provider, Portal, Positioner, Popup, and Arrow anatomy. Provider `delayDuration` became `delay`, positioning props are explicitly forwarded, CSS variables and animations use Base UI hooks, and the default gap is 4px. `src/components/nav-main.tsx` and `src/components/ui/sidebar.tsx` pass trigger elements through `render`. `grep -n "radix-ui\|@radix-ui" src/components/ui/tooltip.tsx` is clean.

## Left alone

Tooltip text, visibility conditions, and sidebar collapse logic were intentionally left unchanged.

## Behavior changes

The tooltip gap changes from 0px to the current shadcn/Base UI 4px default. Base UI's shared instant-open timeout defaults to 400ms rather than Radix's 300ms.

## Verify by hand

Collapse the sidebar, hover and keyboard-focus each icon, confirm tooltip delay, arrow placement on every side, rapid tooltip switching, and Escape dismissal.
