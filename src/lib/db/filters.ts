/** Prisma filter: only rows that have not been soft-deleted. */
export const notDeleted = { deletedAt: null } as const;
