# select

2026-07-09, transformation engine for customized legacy `default` style plus shadcn Base composition rules, migrated successfully.

## Changed

`src/components/ui/select.tsx` now uses Base UI Root, Portal, Positioner, Popup, List, GroupLabel, scroll arrows, ItemText, and ItemIndicator anatomy. Positioning props are explicitly forwarded, Radix CSS variables and state animations use Base UI equivalents, item highlighting uses `data-highlighted`, and the custom overlay layer is preserved. Select consumers in registration, dashboard results, form fields, technician filters, workflow payments/test types, referral profiles, lab confirmation, chart controls, and the data table now provide `items`, group every item within `SelectGroup`, handle nullable Base UI values, and convert collision configuration. `grep -n "radix-ui\|@radix-ui" src/components/ui/select.tsx` is clean.

## Left alone

Calendar, command, and other non-Select third-party components were intentionally untouched. Existing option labels, validation behavior, and controlled form state were preserved.

## Behavior changes

Base UI aligns the selected item with the trigger by default instead of the old wrapper's default popper positioning. Positioner collision padding also follows Base UI's 5px default. The walk-in test selector explicitly disables collision avoidance to preserve its prior configuration.

## Verify by hand

Open every registration and wizard select, technician and results filter, payment method, table selector, and client/court picker; confirm the selected label (not raw value) appears, keyboard navigation and typeahead work, grouped labels are announced, scrolling arrows appear, and popup alignment is acceptable near viewport edges.
