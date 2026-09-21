# Football App — MVP Product & Technical Plan

> Source of truth for the product. MVP scope only — do not build "future" sections unless explicitly asked.

## 1. Product idea

Football pickup-game platform. Core loop:

1. Users register and create a football profile.
2. A field/venue can be booked for a time.
3. A booking becomes a football **Event**.
4. An Event defines match format, number of teams, players per team.
5. Users join an Event, pick a preferred position, or are invited by the organizer.
6. After the match, players rate the players they played with.
7. Player skills are calculated from received ratings.
8. Users see their profile, skills, match history, participation stats.

Feels like a **social football platform**, not a field-booking app.

## 2. MVP goal

Prove the loop: `find/create game → join → choose position → play → rate → update skills`.
Keep architecture simple & maintainable. No premature microservices/k8s/kafka.

## 3. Entities

**User**: id, name, email, password/auth, avatar, createdAt, updatedAt. Has a football profile.
**Player Skills** (computed, never user-set): pace, dribbling, passing, shooting, defending, physical. Each carries the number of ratings used. Aggregation must be isolated/swappable.

## 4. Venue & Field

Venue = location (name, city), contains multiple Fields. Field: id, venueId, name, capacity/format, active. Availability simple for MVP; no external booking/payment.

## 5. Event

id, organizerId, fieldId, startAt, endAt, numberOfTeams, playersPerTeam, status, createdAt, updatedAt.
Statuses: UPCOMING, IN_PROGRESS, FINISHED, CANCELLED. Capacity = numberOfTeams × playersPerTeam.

## 6. Event Participants

eventId, userId, status, preferredPosition, teamId (nullable), joinedAt.
Statuses: JOINED, CANCELLED, ATTENDED, NO_SHOW. Organizer manages participants.

## 7. Positions

MVP: GK, DEF, MID, FWD. Detailed positions (LB/CB/CDM/…) are future — keep extensible.

## 8. Teams

Event has ≥2 teams; count & playersPerTeam set at creation. Organizer assigns players. No auto-balancing in MVP.

## 9. Invitations

eventId, inviterId, invitedUserId, status (PENDING/ACCEPTED/DECLINED), createdAt. In-app only; no SMS/email.

## 10. Event discovery

Filters: date, time range, venue, distance (if easy), available slots, format. Event detail shows venue, field, time, format, slots, participants, teams, organizer, available positions.

## 11. Joining

Open → Join → pick position → become participant. Prevent: joining full/cancelled/finished event, double-join, invalid position.

## 12. Match lifecycle

UPCOMING → IN_PROGRESS → FINISHED. Organizer starts/finishes. On FINISHED, rating flow opens.

## 13. Ratings

After FINISHED, rate players you actually played with. Disallow rating: yourself, non-participants, users from another event. Categories: pace, dribbling, passing, shooting, defending, physical. Scale 1–5. One rating per (player, event). Immutable in MVP (or tightly controlled edits).

## 14. Skill calculation

received ratings → aggregate → skill values (MVP = average). Keep in a separate domain/service layer, never in controllers. Room for weighting, confidence, recency, min-ratings, Bayesian, progression.

## 15. Player profile

Name, avatar, matches played, attendance, six skills + ratings count, recent matches.

## 16. Match history

Per item: event, date, venue, team, opponent info, position, attendance status. No advanced stats yet.

## 17. Notifications

In-app only: invitation received/accepted, event cancelled, event approaching, rating available. No email/push/telegram yet.

## 18. MVP screens

Auth (register/login) · Home/Discover · Event page · Create Event · My Profile · Event management (organizer) · Rating.

## 19–21. Architecture

Frontend → Backend API → PostgreSQL. Modular monolith. Modules: auth, users, players, venues, fields, events, participants, teams, invitations, ratings, skills, notifications. No microservices. Layering: Controller → Service → Domain → Repository → DB. Avoid full DDD unless needed. (Implemented here as: tRPC procedure → @app/domain service → Prisma.)

## 22–24. Future (DO NOT build now)

Auto team balancing, detailed positions, player reputation, match results (scores/W-L-D), advanced stats, social features, recommendations, AI matchmaking, booking & payments.

## 25–26. Core journey & approach

End-to-end: Register → profile → find → open → join → pick position → play → organizer finishes → rate → skills updated → view profile. Build **vertically**; complete the loop before adding endpoints.

## 27. Vision

Field booking → football social network + pickup marketplace + reputation + matchmaking + team balancing + stats. Central loop: find game → play → rate → build reputation → find better games → play again.
