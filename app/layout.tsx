import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "sweetalert2/dist/sweetalert2.min.css";
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
      <body className="tceb-full-container tceb-full-container--soft">{children}</body>
    </html>
  );
}
