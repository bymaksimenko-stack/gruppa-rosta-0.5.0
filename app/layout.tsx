import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ГРУППА РОСТА — личная система",
  description: "Личный курс, годовая цель и 12 недель действий в одном приватном пространстве.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
