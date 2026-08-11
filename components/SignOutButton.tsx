"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function onClick() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={onClick}>
      Sign out
    </button>
  );
}
