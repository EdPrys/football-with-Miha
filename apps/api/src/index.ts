import { buildServer } from './server.js';
import { env } from './env.js';
import { startScheduler } from './jobs/scheduler.js';
import { moveInlineAvatars } from './jobs/move-inline-avatars.js';

const app = buildServer();

// Hosting platforms (Render/Railway/Fly) inject PORT; fall back to API_PORT locally.
const port = Number(process.env.PORT) || env.API_PORT;

app
  .listen({ port, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`API ready at ${address}`);
    startScheduler(app.log);
    void moveInlineAvatars(app.log).catch((err) => app.log.error(err, 'avatars: move failed'));
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
