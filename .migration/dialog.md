# dialog

2026-07-09, transformation engine for customized legacy `default` style, migrated successfully.

## Changed

`src/components/ui/dialog.tsx` now uses Base UI Dialog parts, maps Overlay to Backdrop and Content to Popup, and converts Radix state animations to Base UI transition attributes. The existing controlled-close stale interaction cleanup and custom z-index layers are preserved. `useDismissModal` now targets the open Base UI popup's close control. `src/components/ui/command.tsx:50` passes element triggers through `render` and retains a native trigger fallback for plain content. `grep -n "radix-ui\|@radix-ui" src/components/ui/dialog.tsx` is clean.

## Left alone

Vaul-based `src/components/ui/drawer.tsx` was intentionally untouched because it is not a Radix primitive. Dialog consumers with controlled open state and no triggers required no changes.

## Behavior changes

Base UI consolidates escape and outside-dismiss interception into Root `onOpenChange` event details; the project did not use the removed per-content callbacks.

## Verify by hand

Open command, image-upload, headshot, and workflow dialogs; confirm focus enters the popup, Escape and the close button dismiss it, focus returns to the trigger, the backdrop layers correctly, and stale page interaction locks are cleared.
