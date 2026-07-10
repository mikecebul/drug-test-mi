# button-group

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/button-group.tsx` replaces Radix Slot in ButtonGroupText with Base UI `useRender` and `mergeProps`, retaining default div rendering and all existing styles. `grep -n "radix-ui\|@radix-ui" src/components/ui/button-group.tsx` is clean.

## Left alone

ButtonGroup and ButtonGroupSeparator already use native elements and the migrated Separator wrapper, so their implementations remain unchanged. No ButtonGroupText consumer used `asChild`.

## Behavior changes

None.

## Verify by hand

Inspect grouped buttons in the dashboard profile, confirm joined borders and rounded corners, and verify any rendered ButtonGroupText content aligns correctly.
