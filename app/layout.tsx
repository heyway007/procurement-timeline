import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
