import { collabBoardChannel, collabPageChannel } from "@/lib/collab/config";
import { colorForUser } from "@/lib/collab/user-colors";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { getPusherServer } from "@/lib/realtime/pusher-server";
import { prisma } from "@/lib/db/prisma";

type AuthUser = { id: string; name: string | null; email: string };

export async function authorizePusherChannel(
  user: AuthUser,
  channelName: string,
  socketId: string
) {
  if (channelName.startsWith("presence-board-")) {
    return authorizeBoardChannel(user, channelName, socketId);
  }

  const prefix = "private-page-";
  if (!channelName.startsWith(prefix)) {
    throw new LibraryAccessError("Invalid channel", 403);
  }

  const pageId = channelName.slice(prefix.length);
  const page = await prisma.page.findFirst({ where: { id: pageId } });
  if (!page) throw new LibraryAccessError("Not found", 404);

  await requireLibraryAccess(user.id, page.libraryId, "VIEWER");

  if (collabPageChannel(pageId) !== channelName) {
    throw new LibraryAccessError("Invalid channel", 403);
  }

  return getPusherServer().authorizeChannel(socketId, channelName);
}

async function authorizeBoardChannel(user: AuthUser, channelName: string, socketId: string) {
  const boardId = channelName.slice("presence-board-".length);
  const board = await prisma.document.findFirst({ where: { id: boardId } });
  if (!board) throw new LibraryAccessError("Not found", 404);

  await requireLibraryAccess(user.id, board.libraryId, "VIEWER");

  if (collabBoardChannel(boardId) !== channelName) {
    throw new LibraryAccessError("Invalid channel", 403);
  }

  return getPusherServer().authorizeChannel(socketId, channelName, {
    user_id: user.id,
    user_info: {
      name: user.name || user.email,
      email: user.email,
      color: colorForUser(user.id),
    },
  });
}
