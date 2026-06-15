"use client";

import Image from "next/image";
import Link from "next/link";
import { Grip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileArtwork } from "@/lib/client/file-icons";
import {
  NATIVE_KIND_ORDER,
  NATIVE_TYPES,
} from "@/lib/native/native-types";
import { libraryHome, nativeHomeRoute, readStoredLibraryId } from "@/lib/client/routes";

/**
 * Waffle app launcher — wenlo + native app hubs (Docs, Slides, …) as matching tiles.
 */
export function AppLauncher() {
  const libraryId = readStoredLibraryId();
  const homeHref = libraryId ? libraryHome(libraryId) : "/";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Apps"
            title="Apps"
            className="shrink-0 text-muted-foreground"
          />
        }
      >
        <Grip className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="grid w-auto grid-cols-3 gap-1 p-2">
        <DropdownMenuItem
          className="flex h-auto w-21 flex-col items-center gap-1.5 px-1 py-2.5 text-center"
          render={<Link href={homeHref} />}
        >
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0"
          />
          <span className="text-xs leading-tight">wenlo</span>
        </DropdownMenuItem>
        {NATIVE_KIND_ORDER.map((kind) => {
          const cfg = NATIVE_TYPES[kind];
          return (
            <DropdownMenuItem
              key={kind}
              className="flex h-auto w-21 flex-col items-center gap-1.5 px-1 py-2.5 text-center"
              render={<Link href={nativeHomeRoute(kind)} />}
            >
              <FileArtwork type={cfg.artworkType} className="size-9" />
              <span className="text-xs leading-tight">{cfg.plural}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
