import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AccountForm } from "./AccountForm";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return <AccountForm initialDisplayName={user.displayName} initialUsername={user.username ?? ""} />;
}
