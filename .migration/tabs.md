# tabs

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/tabs.tsx` now uses Base UI Tabs, maps Trigger to Tab and Content to Panel, changes active selectors to `data-active`, and targets `aria-disabled` for disabled tabs. Existing public wrapper names remain unchanged. `grep -n "radix-ui\|@radix-ui" src/components/ui/tabs.tsx` is clean.

## Left alone

Tabs consumers were left unchanged because every trigger is already nested in a TabsList and no removed `activationMode` or `forceMount` props are used.

## Behavior changes

Base UI defaults to manual tab activation: arrow keys move focus and Enter or Space activates the focused tab. Radix previously activated on focus by default.

## Verify by hand

Open the dashboard tables and quick-book widget, click each tab, then use arrow keys followed by Enter or Space and confirm the correct panel appears.
