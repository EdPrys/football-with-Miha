# Backlog

Agreed tasks that are not built yet. Move an item out when it ships.

## 1. Telegram channel: auto-post new games

**Goal:** when a game is created in the app, a post appears in the Telegram channel.

Already in code: `apps/api/src/integrations/telegram.ts` + `event-announcement.ts`,
called from `events.create`. It is a silent no-op until configured.

To do:

- [ ] Create the bot (@BotFather) and the channel; add the bot as a channel admin.
- [ ] Railway → api variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (channel `@name` or `-100…` id),
      `APP_URL=https://kopanka.pro` (link in the post; currently falls back to localhost).
- [ ] Fix post time zone: formatters run on the server (UTC on Railway) — add `timeZone: 'Europe/Kyiv'`.
- [ ] Post text: free slots, organizer; check how the link preview looks.
- [ ] Decide: edit/delete the post when a game is cancelled or fills up? (optional)
