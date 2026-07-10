# avatar

2026-07-09, transformation engine for legacy `default` style, migrated successfully.

## Changed

`src/components/ui/avatar.tsx` now uses the Base UI Avatar Root, Image, and Fallback parts while retaining the existing wrapper names and styles. No `delayMs` consumers required conversion. `grep -n "radix-ui\|@radix-ui" src/components/ui/avatar.tsx` is clean.

## Left alone

Avatar consumers were left unchanged because their props and composition already match Base UI.

## Behavior changes

None.

## Verify by hand

Load an avatar with a valid image and one with a broken image URL; confirm the image and fallback initials render correctly.
