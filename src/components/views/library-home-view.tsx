"use client";

import { CloudView } from "@/components/cloud/cloud-view";

type Props = {
  folderId?: string | null;
};

export function LibraryHomeView({ folderId }: Props) {
  return <CloudView folderId={folderId} />;
}
