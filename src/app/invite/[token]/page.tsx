import { InviteView } from "@/components/views/invite-view";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  return <InviteView token={token} />;
}
