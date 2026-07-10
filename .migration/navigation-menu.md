# navigation-menu

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/navigation-menu.tsx` now uses Base UI NavigationMenu parts, renders trigger chevrons through Icon, and replaces the Radix Viewport with Portal, Positioner, Popup, and Viewport anatomy. Radix state/motion hooks and size variables became Base UI attributes and `--popup-*` variables; list spacing now follows shadcn's `gap-1` rule. The public NavigationMenuIndicator remains as an inert visual passthrough because Base UI has no active-trigger tracking indicator. `grep -n "radix-ui\|@radix-ui" src/components/ui/navigation-menu.tsx` is clean.

## Left alone

No application source currently consumes NavigationMenu, so no call-site props required conversion.

## Behavior changes

Base UI's navigation-menu hover delay defaults to 50ms rather than Radix's 200ms, with no skip-delay window. The exported indicator no longer tracks the active trigger; it is retained only for source compatibility and is currently unused.

## Verify by hand

Render the navigation menu locally, hover and keyboard-open each item, confirm popup sizing and directional transitions, follow links, test focus return and Escape, and assess the faster hover delay.
