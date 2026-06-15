import { Suspense } from "react";
import { PlanSettingsView } from "@/components/views/plan-settings-view";

export default function PlanSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading plans…</p>
        </div>
      }
    >
      <PlanSettingsView />
    </Suspense>
  );
}
