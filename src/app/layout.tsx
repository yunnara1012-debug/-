import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "가맹점 관리",
  description: "호랑이족발 가맹점 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__KAKAO_MAP_KEY__="${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? ''}";`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
