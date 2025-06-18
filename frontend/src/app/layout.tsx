import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CheckYuk!",
  description: "Asisten AI pribadi anda!",
};

import "./globals.css";
import { SocketProvider } from "./context/SocketProvider"; 
import Providers from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SocketProvider> 
          <Providers>{children}</Providers>
        </SocketProvider>
      </body>
    </html>
  );
}
