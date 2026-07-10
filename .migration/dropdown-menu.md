# dropdown-menu

2026-07-09, transformation engine for customized legacy `default` style plus shadcn Base composition rules, migrated successfully.

## Changed

`src/components/ui/dropdown-menu.tsx` now maps Radix DropdownMenu to Base UI Menu, using Portal, Positioner, Popup, split indicators, GroupLabel, and Submenu parts. Positioning props are forwarded, state styling uses `data-highlighted`/`data-popup-open`, and the custom popup layer is preserved. `src/views/DrugTestWizard/workflows/complete-workflow/Workflow.tsx`, `src/components/data-table.tsx`, `src/components/nav-user.tsx`, and `src/components/nav-documents.tsx` now use `render` triggers and group all menu items/labels. Radix `onSelect` handlers became `onClick` with `closeOnClick={false}` to preserve their prevented-close behavior. `grep -n "radix-ui\|@radix-ui" src/components/ui/dropdown-menu.tsx` is clean.

## Left alone

Commented-out future account menu items and unrelated sidebar structure were intentionally left unchanged.

## Behavior changes

Base UI checkbox and radio menu items do not close on click by default, unlike Radix. The current checkbox menu only toggles table columns, so it now remains open while multiple columns are changed. Submenu positioning follows Base UI's logical positioning model.

## Verify by hand

Open appointment, user, document, row-action, and column menus; test arrow-key navigation and typeahead, toggle several columns, invoke each action, confirm focus return and submenu alignment, and check the popup layer above dialogs/drawers.
