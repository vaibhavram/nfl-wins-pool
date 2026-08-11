import { Suspense } from "react";
import { CheckEmailContent } from "./CheckEmailContent";

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailContent />
    </Suspense>
  );
}
