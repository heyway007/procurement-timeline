import { TimelineDetail } from "@/components/timeline/timeline-detail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TimelineDetail projectId={id} />;
}
