# sidebar

2026-07-09, transformation engine for customized hand-rolled Slot compositions, migrated successfully.

## Changed

`src/components/ui/sidebar.tsx` replaces Radix Slot with Base UI `useRender` and `mergeProps` in group labels/actions, menu buttons/actions, and submenu buttons. Popup-open styling now targets `data-popup-open`. Navigation consumers in `src/components/nav-secondary.tsx`, `src/components/nav-main.tsx`, `src/components/nav-documents.tsx`, and `src/components/app-sidebar.tsx` pass links through `render`; tooltip and dropdown render composition remains intact. `grep -n "radix-ui\|@radix-ui" src/components/ui/sidebar.tsx` is clean.

## Left alone

Sidebar context, responsive sheet behavior, cookie persistence, keyboard shortcuts, and Vaul drawer call sites were intentionally left unchanged.

## Behavior changes

None.

## Verify by hand

Expand and collapse the desktop sidebar, open it on mobile, follow every navigation link, open user/document menus, hover collapsed tooltips, and confirm keyboard shortcut, focus, active, and popup-open styles.
