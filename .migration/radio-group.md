# radio-group

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/radio-group.tsx` now combines Base UI RadioGroup with Base UI Radio Root and Indicator parts. Disabled-state styling targets `data-disabled` because Base UI radio roots render spans, and equal dimensions use the shadcn `size-4` utility. `grep -n "radix-ui\|@radix-ui" src/components/ui/radio-group.tsx` is clean.

## Left alone

Radio group consumers were left unchanged because they do not use removed Radix `orientation`, `loop`, `dir`, or `asChild` props.

## Behavior changes

Base UI handles arrow-key navigation across both axes and does not expose Radix's configurable orientation or focus loop; the project did not configure either option.

## Verify by hand

Choose options in the wizard with mouse, Space, and arrow keys; confirm selection, disabled styling, focus movement, and label activation work.
