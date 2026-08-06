import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider, DraftProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "2026 NFL Wins Pool",
  description: "Draft three teams, add up their wins, most wins takes the pool.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <DraftProvider>{children}</DraftProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
