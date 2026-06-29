import "./globals.css";
import { Figtree } from "next/font/google";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata = {
  title: "Aydin Assignments",
  description: "A focused Airtable-backed assignment list and calendar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
