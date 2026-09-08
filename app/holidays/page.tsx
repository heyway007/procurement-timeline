import { HolidayManager } from "@/components/holidays/holiday-manager";
import { AuthenticatedShell } from "@/components/auth/authenticated-shell";

export default function HolidaysPage() {
  return <AuthenticatedShell><HolidayManager /></AuthenticatedShell>;
}
