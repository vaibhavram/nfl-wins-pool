import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

/** Shared auth gate for every signed-in-only route under this group (the pools dashboard,
 * create/invite/settings in Phase 2, pool-scoped screens in Phase 3). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.onboarded) redirect("/onboarding");

  return <div className="app-shell">{children}</div>;
}
