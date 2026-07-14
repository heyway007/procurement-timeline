import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: "แผนงานจัดซื้อจัดจ้าง",
  description: "ระบบวางแผน Timeline งานจัดซื้อจัดจ้างตามวันทำการราชการไทย",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th">
      <body className={notoSansThai.variable}>{children}</body>
    </html>
  );
}
