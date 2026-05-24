import { Suspense } from "react";
import { AuthView } from "@/components/views/auth-view";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string; redirect?: string }>;
};

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const { mode, redirect } = await searchParams;
  const defaultTab = mode === "signup" ? "signup" : "signin";
  const redirectTo = redirect?.startsWith("/") ? redirect : "/";

  return <AuthView defaultTab={defaultTab} redirectTo={redirectTo} />;
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent {...props} />
    </Suspense>
  );
}
