import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

export const env = schema.parse(process.env);
