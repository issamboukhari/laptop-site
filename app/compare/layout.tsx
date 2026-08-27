import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Computers",
  description:
    "Side-by-side computer comparison: exact specifications, hardware-grounded multi-criteria ratings, gaming analysis and instant Gemini AI advice.",
  robots: { index: false, follow: true },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
