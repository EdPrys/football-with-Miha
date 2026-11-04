# Responsive UI review — 2026-11-04

Code review covered the player and admin shells, search, game creation/details,
lineups, rating, profiles, venue forms, notifications and shared form/dialog controls.

Changes:

- Admin navigation wraps into its own row below 640px; account names are bounded.
  User role controls stack below account details on phones.
- Rating stars have 44px targets and sit below player identity below 640px.
  Team carousel arrows/dots and the city trigger also have 44px targets.
- Shared buttons, inputs, selects and skill sliders provide larger touch targets
  on coarse-pointer devices, including tablets at desktop breakpoints.
  Native form text stays at 16px on those devices to avoid iOS focus zoom.
- Dialogs have a dynamic viewport height limit and internal scrolling; headings
  reserve space for close controls. City options respect available popup height.
- Both apps opt into display safe areas; headers, content and mobile navigation
  account for cutouts. Profile names wrap; select values can shrink in flex layouts.
- Both apps honor reduced-motion preferences and expose keyboard focus; star
  selection and admin navigation expose their current state to assistive tools.

## Verification limits

This is a code review, not a completed visual/device audit. Neither system Chrome
nor the compatible Playwright Chromium could launch in the local environment
(SIGABRT/SIGTRAP); the native UI service also failed to start. No screenshots or
successful viewport measurements were obtained. Production builds locally could
not fetch Geist/Geist Mono from Google Fonts. See the task PR for CI results.
Real-player testing remains pending in [USABILITY_TEST.md](USABILITY_TEST.md).

## Pending browser/device checks

Use test accounts and an isolated test database for mutations.

- At 320, 390, 640, 768, 1024 and 1440 CSS pixels, check both themes, portrait and
  landscape: no page-level horizontal scrolling, clipped names or covered actions.
- Check player navigation/search, long venue names, game creation with date/time
  controls, 2–4 team lineups, profile/skills and the post-game rating screen.
- Open invitation and venue dialogs on a short landscape viewport; verify all
  fields, close and submit remain reachable by scrolling and with the keyboard open.
- Check admin navigation while authenticated, long account names/emails, role
  selection and expanded venue/field editors on a narrow phone.
- On iOS Safari and Android Chrome, check focus zoom, safe areas, touch targets,
  keyboard focus/escape behavior, dropdowns, rotation and reduced-motion settings.
- At 200% browser zoom, verify that navigation and forms remain usable.
