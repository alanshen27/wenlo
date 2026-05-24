import { Suspense } from "react";
import { AuthView } from "@/components/views/auth-view";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string }>;
};

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

async function LoginContent({ searchParams }: LoginPageProps) {
  const { mode } = await searchParams;
  const defaultTab = mode === "signup" ? "signup" : "signin";

  return <AuthView defaultTab={defaultTab} />;
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent {...props} />
    </Suspense>
  );
}
