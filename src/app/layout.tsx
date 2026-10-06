import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "F1 Race Analyzer",
  description: "Historical race analytics with explanations grounded in evidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header><nav aria-label="Main navigation"><Link href="/">F1 Race Analyzer</Link><Link href="/methodology">Methodology</Link></nav></header>
        <main id="main">{children}</main>
        <footer>Independent learning project. Not affiliated with Formula 1.</footer>
      </body>
    </html>
  );
}
