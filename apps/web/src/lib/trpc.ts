import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@app/api';

export const trpc = createTRPCReact<AppRouter>();
