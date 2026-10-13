import type { Metadata } from "next";
import "./globals.css";
import { brand } from "@/lib/brand";
export const metadata: Metadata = {
  title: {
    default: `${brand.name} — ${brand.descriptor}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.tagline,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
