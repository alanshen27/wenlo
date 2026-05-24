import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RedirectToLibrary } from "@/components/library/redirect-to-library";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <RedirectToLibrary />;
}
