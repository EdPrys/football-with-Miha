import type { NotificationType, Prisma, PrismaClient } from '@app/db';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  payload: Prisma.InputJsonValue;
}

/** Fire-and-record a notification. Delivery (Telegram, push, ...) is a separate concern. */
export function notify(prisma: PrismaClient, input: NotifyInput) {
  return prisma.notification.create({ data: input });
}

export function notifyMany(prisma: PrismaClient, inputs: NotifyInput[]) {
  if (inputs.length === 0) return Promise.resolve({ count: 0 });
  return prisma.notification.createMany({ data: inputs });
}
