import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import type { ReactNode } from "react";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";

const kanit = Kanit({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-kanit",
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
      <body className={kanit.variable}>{children}</body>
    </html>
  );
}
