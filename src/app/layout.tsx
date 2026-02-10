import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GyanSetu — Google Workspace Learning",
  description:
    "A secure, scalable learning platform built on Google Workspace",
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
