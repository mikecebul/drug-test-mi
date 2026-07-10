# progress

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/progress.tsx` now uses Base UI Progress with the required Track anatomy. The primitive now computes indicator width, replacing the Radix-specific manual `translateX` transform while preserving the existing dimensions and colors. `grep -n "radix-ui\|@radix-ui" src/components/ui/progress.tsx` is clean.

## Left alone

Progress consumers were left unchanged because they already pass numeric values supported by Base UI.

## Behavior changes

None.

## Verify by hand

Advance through the registration wizard and confirm the progress bar grows smoothly from empty to complete at the expected steps.
