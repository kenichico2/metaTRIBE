import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto Excitement — TRIBEv2 Brain Viewer",
  description:
    "shi3z/auto-excitement (Meta TRIBEv2) を簡単に利用するためのウェブフロントエンド。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
