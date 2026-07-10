# scroll-area

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/scroll-area.tsx` now uses Base UI ScrollArea parts, maps the Radix scrollbar and thumb names to `Scrollbar` and `Thumb`, and adds the Base UI Content wrapper inside the Viewport for correct overflow measurement. `grep -n "radix-ui\|@radix-ui" src/components/ui/scroll-area.tsx` is clean.

## Left alone

No source consumers currently render ScrollArea, so no removed Radix `type`, `scrollHideDelay`, or `dir` props required conversion.

## Behavior changes

Scrollbar visibility is now driven by Base UI overflow state rather than Radix's configurable visibility modes; no consumer configured a mode.

## Verify by hand

Render content with vertical and horizontal overflow, then confirm wheel, track, thumb dragging, and corner layout work with mouse and touch input.
