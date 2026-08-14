import { getCurrentUser } from "@/lib/auth/current-user";
import { CreatePoolForm } from "./CreatePoolForm";

export default async function CreatePoolPage() {
  const user = await getCurrentUser();
  return <CreatePoolForm username={user?.username ?? null} />;
}
