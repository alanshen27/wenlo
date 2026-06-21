"use client";

import { QueryCache, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "@/lib/client/query-keys";
import { USAGE_UPDATED_EVENT } from "@/lib/billing/usage-events";
import { toastError } from "@/lib/client/toast";

function MeUsageSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onUsageUpdated = () => void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    window.addEventListener(USAGE_UPDATED_EVENT, onUsageUpdated);
    return () => window.removeEventListener(USAGE_UPDATED_EVENT, onUsageUpdated);
  }, [queryClient]);

  return null;
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const message = query.meta?.errorMessage;
        if (typeof message === "string") toastError(error, message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={client}>
      <MeUsageSync />
      {children}
    </QueryClientProvider>
  );
}
