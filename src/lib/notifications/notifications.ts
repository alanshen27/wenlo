import { prisma } from "@/lib/db/prisma";

export type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
};

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({ data: input });
}

export async function listNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markNotificationRead(userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
