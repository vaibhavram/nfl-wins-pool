"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useDraft } from "@/lib/store";

export default function RootPage() {
  const router = useRouter();
  const { hydrated: authHydrated, manager } = useAuth();
  const { hydrated: draftHydrated, draftComplete } = useDraft();

  useEffect(() => {
    if (!authHydrated || !draftHydrated) return;
    if (!manager) {
      router.replace("/sign-in");
    } else if (draftComplete) {
      router.replace("/leaderboard");
    } else {
      router.replace("/lobby");
    }
  }, [authHydrated, draftHydrated, manager, draftComplete, router]);

  return null;
}
