import { redirect } from "next/navigation";
import { listOrganizationsForCurrentUser } from "@/lib/organizations/dal";

export default async function DashboardIndexPage() {
  const organizations = await listOrganizationsForCurrentUser();
  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  redirect(`/dashboard/${organizations[0].slug}`);
}
