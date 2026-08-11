import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NFL Wins Pool",
  description: "Draft three teams, add up their wins, most wins takes the pool.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
