# button

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/button.tsx` now uses `@base-ui/react/button` and exposes Base UI's `render` API. Button-link consumers in `src/views/beforeNavLinks/DrugTestCollectorLink.tsx`, `src/views/beforeNavLinks/DrugTestTrackerLink.tsx`, `src/app/(frontend)/not-found.tsx`, `src/collections/DrugTests/views/DrugTestSummaryView.tsx`, `src/app/(frontend)/verify-email/page.tsx`, `src/app/dashboard/error.tsx`, `src/app/dashboard/DashboardView.tsx`, `src/app/dashboard/profile/ProfileView.tsx`, and `src/components/Link/index.tsx` now pass their link through `render` with `nativeButton={false}`. `grep -n "radix-ui\|@radix-ui" src/components/ui/button.tsx` is clean.

## Left alone

Button styling variants and unrelated button consumers were intentionally left unchanged so the existing visual design and behavior remain intact.

## Behavior changes

None.

## Verify by hand

Open the dashboard and admin navigation, follow each button-styled link, and confirm disabled buttons, keyboard focus rings, and external-link targets still behave correctly.
