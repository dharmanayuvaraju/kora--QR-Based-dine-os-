import type { Metadata, Viewport } from "next";
import "./globals.css";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://kora-qr-based-dine-os-67os.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "KORA Kitchen & Grill | Table QR Ordering & Dining OS",
    template: "%s | KORA Kitchen & Grill",
  },
  description:
    "Order from your table at KORA Kitchen & Grill. Live kitchen display, waiter floor service, real-time dish stock tracking, and combined GST table billing.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
  openGraph: {
    type: "website",
    siteName: "KORA Kitchen & Grill",
    title: "KORA Kitchen & Grill | Table QR Ordering & Dining OS",
    description:
      "Scan your table QR to browse KORA's menu, track dishes live from the kitchen pass, and settle one combined table bill.",
    url: appUrl,
    images: [
      {
        url: "/dishes/chicken-65-med.webp",
        width: 560,
        height: 560,
        alt: "KORA Kitchen & Grill signature dishes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KORA Kitchen & Grill | Table QR Ordering",
    description:
      "Tabletop QR ordering, live kitchen pass tracking, and combined GST billing for KORA Kitchen & Grill.",
    images: ["/dishes/chicken-65-med.webp"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAF7F2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-[#FAF7F2] font-sans text-[#1C1917] antialiased selection:bg-[#C2410C]/15 selection:text-[#9A3412]">
        {children}
      </body>
    </html>
  );
}
