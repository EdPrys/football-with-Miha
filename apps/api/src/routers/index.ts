import { router } from '../trpc.js';
import { authRouter } from './auth.js';
import { venuesRouter } from './venues.js';
import { eventsRouter } from './events.js';

export const appRouter = router({
  auth: authRouter,
  venues: venuesRouter,
  events: eventsRouter,
});

export type AppRouter = typeof appRouter;
