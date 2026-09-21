import { buildServer } from './server.js';
import { env } from './env.js';

const app = buildServer();

// Hosting platforms (Render/Railway/Fly) inject PORT; fall back to API_PORT locally.
const port = Number(process.env.PORT) || env.API_PORT;

app
  .listen({ port, host: '0.0.0.0' })
  .then((address) => app.log.info(`API ready at ${address}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
