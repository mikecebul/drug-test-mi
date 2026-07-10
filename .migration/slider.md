# slider

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/slider.tsx` now uses Base UI's Root, Control, Track, Indicator, and Thumb anatomy. The Radix Range became Indicator, interactive layout moved to Control, `thumbAlignment="edge"` preserves endpoint placement, and disabled styling uses `data-disabled`. `grep -n "radix-ui\|@radix-ui" src/components/ui/slider.tsx` is clean.

## Left alone

No slider consumers exist in the current source tree, so no call-site props required conversion.

## Behavior changes

Base UI exposes scalar values for single-thumb sliders and renames `onValueCommit` to `onValueCommitted`; there are no current consumers relying on the old signatures.

## Verify by hand

Render the slider in Storybook or a local page, then drag it to both endpoints and confirm pointer, keyboard, disabled, and focus behavior.
