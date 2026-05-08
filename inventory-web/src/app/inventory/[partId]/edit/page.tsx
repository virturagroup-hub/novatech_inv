import { PartEditorPage } from "@/components/pages/part-editor-page";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ partId: string }>;
}>) {
  const { partId } = await params;
  return <PartEditorPage mode="edit" partId={partId} />;
}

