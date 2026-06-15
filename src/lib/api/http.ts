import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError } from "@/lib/library/library-access";
import type { User } from "@/generated/prisma/client";

/**
 * Lightweight building blocks for route handlers so individual routes stop
 * re-implementing auth, error mapping, and body parsing. Throw an `HttpError`
 * (or a known domain error) from anywhere inside a handler and it becomes the
 * right JSON response; everything unexpected becomes a logged generic 500.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message = "Bad request") => new HttpError(400, message);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, message);
export const forbidden = (message = "Forbidden") => new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);

/** Map any thrown value to a JSON error response (no internals leaked). */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof LibraryAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", issues: error.issues }, { status: 400 });
  }
  // `requireUser()` throws a bare Error("Unauthorized").
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error("[api]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

type RouteContext<P> = { params: Promise<P> };

/**
 * Run a route body with centralized error handling. Keep using the native
 * Next handler signature at the export site so route type-checking stays intact:
 *
 *   export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
 *     return withRoute(ctx, async ({ params }) => NextResponse.json(...));
 *   }
 */
export async function withRoute<P = Record<string, never>>(
  context: RouteContext<P> | undefined,
  fn: (ctx: { params: P }) => Promise<Response>
): Promise<Response> {
  try {
    const params = ((await context?.params) ?? {}) as P;
    return await fn({ params });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Like {@link withRoute} but resolves the authenticated user first (401 if absent). */
export async function withAuth<P = Record<string, never>>(
  context: RouteContext<P> | undefined,
  fn: (ctx: { params: P; user: User }) => Promise<Response>
): Promise<Response> {
  return withRoute(context, async ({ params }) => {
    const user = await requireUser();
    return fn({ params, user });
  });
}

/** Parse and validate a JSON body with a zod schema. Throws 400 on failure. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
  return schema.parse(json);
}
