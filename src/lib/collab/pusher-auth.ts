import { collabPageChannel } from "@/lib/collab/config";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import { getPusherServer } from "@/lib/pusher-server";
import { prisma } from "@/lib/prisma";

export async function authorizePusherChannel(
  userId: string,
  channelName: string,
  socketId: string
) {
  const prefix = "private-page-";
  if (!channelName.startsWith(prefix)) {
    throw new LibraryAccessError("Invalid channel", 403);
  }

  const pageId = channelName.slice(prefix.length);
  const page = await prisma.page.findFirst({ where: { id: pageId } });
  if (!page) throw new LibraryAccessError("Not found", 404);

  await requireLibraryAccess(userId, page.libraryId, "VIEWER");

  if (collabPageChannel(pageId) !== channelName) {
    throw new LibraryAccessError("Invalid channel", 403);
  }

  return getPusherServer().authorizeChannel(socketId, channelName);
}
