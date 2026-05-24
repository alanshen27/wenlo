import { LibraryShell } from "@/components/library/library-shell";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <LibraryShell>{children}</LibraryShell>;
}
