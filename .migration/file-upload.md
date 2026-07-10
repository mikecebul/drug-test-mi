# file-upload

2026-07-09, transformation engine for customized hand-rolled Slot compositions, migrated successfully.

## Changed

`src/components/ui/file-upload.tsx` replaces every Radix Slot branch with a shared Base UI `useRender`/`mergeProps` primitive across the root, dropzone, trigger, list, item, preview, metadata, progress, delete, and clear components. Default tags, event ordering, accessibility attributes, state classes, upload state, and conditional mounting remain intact. The preview content callback is now named `renderPreview`, reserving Base UI's `render` prop for element composition. `src/blocks/Form/field-components/file-upload-field.tsx:109` passes the delete Button through `render`. `grep -n "radix-ui\|@radix-ui" src/components/ui/file-upload.tsx` is clean.

## Left alone

File validation, object URL lifecycle, upload progress, TanStack Form integration, and the native hidden file input were intentionally left unchanged.

## Behavior changes

The optional custom preview-content prop is renamed from `render` to `renderPreview`; there were no current consumers. Element polymorphism now uses the Base UI `render` prop instead of `asChild`.

## Verify by hand

Upload valid and invalid files by click, drag/drop, paste, and keyboard; verify previews, metadata, linear/circular/fill progress, delete/clear buttons, validation messages, multiple-file limits, disabled state, and object URL cleanup.
