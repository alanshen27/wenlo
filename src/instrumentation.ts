export async function register() {
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}
