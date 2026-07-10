# toggle-group

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/toggle-group.tsx` now composes Base UI's callable ToggleGroup with Base UI Toggle items while retaining the existing variant context. `src/components/chart-area-interactive.tsx:174` drops `type="single"`, wraps the controlled value in an array, and unwraps the Base UI change value. `grep -n "radix-ui\|@radix-ui" src/components/ui/toggle-group.tsx` is clean.

## Left alone

The standalone Toggle wrapper and the chart's styling were intentionally left unchanged.

## Behavior changes

Base UI uses an always-array value model and always enables roving focus; the project had no `rovingFocus={false}` usage, so no visible behavior change is expected.

## Verify by hand

Use mouse and arrow keys on the chart time-range control, confirm only one option is pressed, and verify deselecting an option preserves the existing empty-value behavior.
