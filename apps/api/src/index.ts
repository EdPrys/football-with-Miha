import { buildServer } from './server.js';
import { env } from './env.js';

const app = buildServer();

app
  .listen({ port: env.API_PORT, host: '0.0.0.0' })
  .then((address) => app.log.info(`API ready at ${address}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
