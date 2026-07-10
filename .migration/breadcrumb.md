# breadcrumb

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/breadcrumb.tsx` replaces Radix Slot in BreadcrumbLink with Base UI `useRender` and `mergeProps`. `src/components/DashboardBreadcrumb.tsx:92` now passes Next Link through the `render` prop. `grep -n "radix-ui\|@radix-ui" src/components/ui/breadcrumb.tsx` is clean.

## Left alone

The native breadcrumb list, item, separator, page, and ellipsis elements were already independent of Radix and remain unchanged.

## Behavior changes

None.

## Verify by hand

Navigate several dashboard routes, follow each breadcrumb link, and confirm current-page semantics, keyboard focus, separators, and link styling remain correct.
