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

## 2. MVP of the match

**Goal:** after each game one player becomes MVP; every player has an MVP count shown
as a number on the top of their avatar.

To do:

- [ ] DB: `MvpVote (eventId, voterId, nomineeId)` unique per `(eventId, voterId)`;
      winners per game (several on a tie, e.g. `EventMvp (eventId, userId)`) and a per-player
      MVP counter (`mvpCount`) — counter can also be derived, decide when building.
- [ ] Domain: every ATTENDED player gets one vote within the same 24h window as stars;
      can't vote for yourself. **Most votes wins; on a tie every tied player is MVP.**
- [ ] Close voting after 24h → set the winner(s) on the game, increment their MVP count, notify.
- [ ] UI: "Обрати MVP" on the finished game page (list of co-players), MVP badge on the
      game page, a small badge on the top of the avatar (pitch + profile) in the form
      **`!2`** = two MVPs; hidden while the count is 0.
