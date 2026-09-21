import { router } from '../trpc.js';
import { authRouter } from './auth.js';
import { venuesRouter } from './venues.js';
import { eventsRouter } from './events.js';
import { ratingsRouter } from './ratings.js';
import { playersRouter } from './players.js';

export const appRouter = router({
  auth: authRouter,
  venues: venuesRouter,
  events: eventsRouter,
  ratings: ratingsRouter,
  players: playersRouter,
});

export type AppRouter = typeof appRouter;
