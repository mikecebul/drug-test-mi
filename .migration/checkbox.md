# checkbox

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/checkbox.tsx` now uses Base UI Checkbox parts. Radix checked-state selectors became `data-checked`, and disabled styling now targets `data-disabled` because Base UI renders the root as a span. `src/components/data-table.tsx:137` now passes the mixed state through Base UI's separate `indeterminate` prop instead of the Radix string sentinel. `grep -n "radix-ui\|@radix-ui" src/components/ui/checkbox.tsx` is clean.

## Left alone

Existing checkbox consumers and their boolean change handlers were left unchanged because they remain type-safe with Base UI.

## Behavior changes

None.

## Verify by hand

Toggle checkboxes with mouse and Space, then confirm checked, disabled, focus-visible, and validation styles render correctly.
