import { Dashboard } from "@/components/dashboard/dashboard";
import { AuthenticatedShell } from "@/components/auth/authenticated-shell";

export default function HomePage() {
  return <AuthenticatedShell><Dashboard /></AuthenticatedShell>;
}
