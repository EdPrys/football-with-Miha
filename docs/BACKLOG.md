# Backlog and verification

Updated 2026-11-02. Code existence and production verification are separate.

## Production checks

- Verify Telegram bot/channel variables and posting permissions in the intended deployment.
  Posting, stored message id, deletion of an empty game's post and Europe/Kyiv formatting
  are implemented. Do not treat the former timezone task as missing code.
- Verify GA4/Meta events and UTM registration attribution end to end before advertising.
  See `MARKETING_PILOT.md`; no campaign launch is recorded there.
- Confirm actual service ports, domains and health in the intended Coolify deployment;
  the reported 502 needs runtime/container logs. See `DEPLOYMENT.md`.
- Smoke-test the complete two-player flow against a dedicated test database.

## Product decisions

- Decide whether Telegram posts should be edited as places fill or games are cancelled.
  Deleting an empty game already requests deletion of its stored Telegram post.
- Choose city, live matches, budget and channel for the first marketing test.
- Review automatic approval of organizer role before changing access policy.

## Developer onboarding

API explorer and setup/API/architecture/deployment documentation are now in the
repository. Keep procedure metadata and docs synchronized with implementation.
No React Native app, payment or external field-booking integration is implemented.
