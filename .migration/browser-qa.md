# Base UI browser QA

2026-07-10, production-browser verification completed for every wrapper migrated from Radix UI to Base UI.

## Coverage

| Component | Browser checks | Result |
| --- | --- | --- |
| Avatar | fallback size, circular crop, centering | Passed |
| Badge | variants and polymorphic link rendering | Passed |
| Breadcrumb | semantics, links, current item | Passed |
| Button group | grouping semantics, separators, hit targets | Passed |
| Button | variants, disabled state, pointer behavior | Passed |
| Checkbox | pointer, Space key, label association, state | Passed |
| Dialog | overlay, focus entry/return, Escape, scroll lock | Passed |
| Dropdown menu | keyboard/pointer open, checkbox/radio, submenu, close, focus return | Passed after fix |
| File upload | file display, removal, render composition | Passed |
| Label | control association and click target | Passed |
| Navigation menu | popup sizing, hit targets, route/hash links, close behavior | Passed after fix |
| Popover | positioning, focus entry/return, Escape | Passed |
| Progress | ARIA value and indicator update | Passed |
| Radio group | pointer selection and state | Passed |
| Scroll area | real wheel scrolling and overflow | Passed |
| Select | option groups, selection, close, focus return | Passed |
| Separator | horizontal/vertical sizing and semantics | Passed |
| Sheet | overlay, right-side placement, close, focus return | Passed |
| Sidebar | expanded/collapsed state, trigger, polymorphic links | Passed |
| Slider | keyboard increment and state update | Passed |
| Tabs | selection and panel switching | Passed |
| Toggle group | exclusive selection and pressed state | Passed |
| Toggle | pressed state | Passed |
| Tooltip | keyboard focus, positioning, close behavior | Passed |

## Responsive and workflow checks

- The complete harness was inspected at 1280×720 and 390×844 with no document or section overflow.
- The production mobile header sheet opened and closed correctly at 390×844; focus returned to the trigger and body scrolling was restored.
- The production Payload admin dashboard loaded without application console errors, QuickBook tabs switched panels, and the Drug Test Tracker confirmation dialog opened, rendered its checkboxes, and cancelled without mutation.
- The client dashboard could not be entered with the active admin session because its access redirect correctly returned to `/admin`; the shared sidebar wrapper was covered independently in the harness.

## Regressions fixed

1. Dropdown checkbox and radio items now close by default, matching Radix behavior. Consumers that intentionally support multi-selection keep `closeOnClick={false}`.
2. Navigation menu content no longer carries Radix-era absolute positioning that collapsed Base UI's viewport to 2×2 pixels. Route links and same-document hash links now navigate and close the popup correctly.
3. The mobile header's icon-only sheet trigger now has an accessible name.

## Environment note

The only production console error observed was Google Maps `InvalidKeyMapError`, caused by the local API-key configuration and unrelated to the component migration.
