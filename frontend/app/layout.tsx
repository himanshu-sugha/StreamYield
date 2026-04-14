import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StreamYield | AI-Powered Payroll Streaming on HashKey Chain",
  description:
    "Turn payroll from a cost into a profit center. Stream salaries per-second while AI routes your unvested capital into RWA yield vaults on HashKey Chain.",
  keywords: "HashKey Chain, DeFi, PayFi, AI, payroll streaming, RWA, yield, HSK",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
