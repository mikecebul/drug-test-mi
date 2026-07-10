# label

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/label.tsx` now renders a native `<label>` because Base UI has no standalone Label primitive; the existing classes and public component name are unchanged. `grep -n "radix-ui\|@radix-ui" src/components/ui/label.tsx` is clean.

## Left alone

Form consumers were left unchanged because they already use the standard `htmlFor` API supported by the native label.

## Behavior changes

None.

## Verify by hand

Click labels beside inputs, checkboxes, and radio controls and confirm focus or selection moves to the associated control.
