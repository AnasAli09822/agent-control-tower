import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Control Tower",
  description: "Operational control plane for autonomous agents",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
