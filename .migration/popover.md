# popover

2026-07-09, transformation engine for customized legacy `default` style, migrated successfully.

## Changed

`src/components/ui/popover.tsx` now uses Base UI Portal, Positioner, and Popup anatomy, forwards all exposed positioning props to Positioner, and converts Radix animation state selectors to Base UI transitions while preserving the custom overlay layer. Popover triggers in the date, date-time, range, DOB, and form field pickers now pass Button through `render`. `grep -n "radix-ui\|@radix-ui" src/components/ui/popover.tsx` is clean.

## Left alone

Calendars remain powered by `react-day-picker`, which is intentionally outside this Radix migration.

## Behavior changes

Base UI collision padding defaults to 5px instead of Radix's 0px and centralizes dismiss interception on Root `onOpenChange`; no consumers overrode those behaviors.

## Verify by hand

Open every date and date-time picker near viewport edges, confirm alignment and collision handling, choose a date, dismiss with Escape/outside click, and verify focus returns to the trigger.
