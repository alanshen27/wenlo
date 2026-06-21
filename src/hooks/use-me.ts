"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/query-keys";
import type { Me } from "@/lib/client/me";
import { toastError } from "@/lib/client/toast";

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiGet<Me>("/api/me"),
  });
}

type UpdateMeInput = {
  name?: string;
  avatarUrl?: string | null;
  completeOnboarding?: boolean;
};

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateMeInput) => apiPatch<Partial<Me>>("/api/me", input),
    onSuccess: (data) => {
      queryClient.setQueryData<Me>(queryKeys.me, (prev) =>
        prev ? { ...prev, ...data } : prev
      );
    },
    onError: (error) => toastError(error, "Couldn't update profile"),
  });
}

export function useInvalidateMe() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.me });
}
