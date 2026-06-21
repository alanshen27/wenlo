import { TrashView } from "@/components/views/trash-view";

type Props = {
  params: Promise<{ libraryId: string }>;
};

export default async function TrashPage({ params }: Props) {
  const { libraryId } = await params;
  return <TrashView libraryId={libraryId} />;
}
