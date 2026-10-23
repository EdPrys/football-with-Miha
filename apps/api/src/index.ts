import { buildServer } from './server.js';
import { env } from './env.js';
import { startAutoFinishJob } from './jobs/auto-finish.js';

const app = buildServer();

// Hosting platforms (Render/Railway/Fly) inject PORT; fall back to API_PORT locally.
const port = Number(process.env.PORT) || env.API_PORT;

app
  .listen({ port, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`API ready at ${address}`);
    startAutoFinishJob(app.log);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
