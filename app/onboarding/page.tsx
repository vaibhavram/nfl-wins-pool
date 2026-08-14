import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { OnboardingForm } from "./OnboardingForm";

/** Matches the API's USERNAME_PATTERN (3-20 chars: letters, numbers, underscores) so the
 * suggested default is always something the form can submit as-is. */
function suggestUsername(email: string | null): string {
  if (!email) return "";
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return local.slice(0, 20).replace(/^_|_$/g, "");
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.onboarded) redirect(redirectTo ?? "/pools");

  return (
    <OnboardingForm
      redirectTo={redirectTo ?? "/pools"}
      initialDisplayName={user.displayName}
      initialUsername={user.username ?? suggestUsername(user.email)}
      initialPhone={user.phone ?? ""}
    />
  );
}
