import { TimelineDetail } from "@/components/timeline/timeline-detail";
import { AuthenticatedShell } from "@/components/auth/authenticated-shell";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuthenticatedShell><TimelineDetail projectId={id} /></AuthenticatedShell>;
}
