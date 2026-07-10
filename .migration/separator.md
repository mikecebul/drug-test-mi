# separator

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/separator.tsx` now uses the callable Base UI Separator primitive and drops Radix's unsupported `decorative` prop. Existing orientation styling is unchanged. `grep -n "radix-ui\|@radix-ui" src/components/ui/separator.tsx` is clean.

## Left alone

Separator consumers were left unchanged because none passed the removed `decorative` prop.

## Behavior changes

Base UI separators always expose semantic separator behavior, whereas the old wrapper defaulted to decorative separators.

## Verify by hand

Inspect horizontal and vertical separators visually and confirm screen-reader landmarks do not become distracting in the primary dashboard and footer flows.
