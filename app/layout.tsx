import type { Metadata } from "next";
import "./globals.css";

const title = "The Wins Pool";
const description = "Draft three teams, add up their wins, most wins takes the pool.";
const siteUrl = "https://thewinspool.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: title,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: title }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/twitter-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
