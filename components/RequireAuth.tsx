"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useDraft } from "@/lib/store";

export function RequireAuth({
  children,
  requireDraftComplete,
}: {
  children: React.ReactNode;
  /** true: bounce to /draft until it's done. false: bounce to /lobby once it's done. undefined: no draft-state check. */
  requireDraftComplete?: boolean;
}) {
  const router = useRouter();
  const { hydrated: authHydrated, manager } = useAuth();
  const { hydrated: draftHydrated, draftComplete } = useDraft();
  const ready = authHydrated && (requireDraftComplete === undefined || draftHydrated);

  useEffect(() => {
    if (!ready) return;
    if (!manager) {
      router.replace("/sign-in");
      return;
    }
    if (requireDraftComplete === true && !draftComplete) {
      router.replace("/draft");
    } else if (requireDraftComplete === false && draftComplete) {
      router.replace("/leaderboard");
    }
  }, [ready, manager, draftComplete, requireDraftComplete, router]);

  if (!ready || !manager) return null;
  if (requireDraftComplete === true && !draftComplete) return null;
  if (requireDraftComplete === false && draftComplete) return null;

  return <>{children}</>;
}
