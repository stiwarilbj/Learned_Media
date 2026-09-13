import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learned Media — Learn something every time you scroll.",
  description: "A social feed for obscure, useful knowledge.",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
