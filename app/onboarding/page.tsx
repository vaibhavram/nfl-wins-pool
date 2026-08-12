import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { OnboardingForm } from "./OnboardingForm";

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
      initialUsername={user.username ?? ""}
      initialPhone={user.phone ?? ""}
    />
  );
}
