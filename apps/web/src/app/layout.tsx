import type { Metadata } from "next";
import { connection } from "next/server";
import "@fontsource-variable/archivo/wght.css";
import "@fontsource-variable/fraunces/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PedigreePal | A trustworthy pedigree workspace",
    template: "%s | PedigreePal",
  },
  description:
    "Private pedigree records, organization controls, and optional public proof for responsible breeding programs.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
