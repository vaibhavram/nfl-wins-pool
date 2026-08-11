import { Suspense } from "react";
import { LinkConsumeContent } from "./LinkConsumeContent";

export default function AuthLinkPage() {
  return (
    <Suspense fallback={null}>
      <LinkConsumeContent />
    </Suspense>
  );
}
