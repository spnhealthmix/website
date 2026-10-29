import type { Metadata } from "next";
import { Archivo, DM_Serif_Display, Inter, Lora, Manrope, Nunito_Sans, PT_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

const ptSerif = PT_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-pt-serif",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-lora",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-dm-serif",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-archivo",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-nunito-sans",
});

export const metadata: Metadata = {
  title: {
    default: "SPN Health Mix — Traditional Indian Health Foods",
    template: "%s | SPN Health Mix",
  },
  description:
    "Traditional Indian health mixes, spice powders, podis, masalas and snacks. Packaged with care for modern households.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://spn-foods.vercel.app"
  ),
  openGraph: {
    type: "website",
    siteName: "SPN Health Mix",
    locale: "en_IN",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&family=BJCree:wght@400;500;600;700&family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${lora.variable} ${dmSerifDisplay.variable} ${manrope.variable} ${archivo.variable} ${nunitoSans.variable} ${inter.variable} ${ptSerif.variable}`}
        style={
          {
            "--font-logo": `var(--font-lora), "Lora", Georgia, serif`,
            "--font-heading": `var(--font-dm-serif), "DM Serif Display", Georgia, serif`,
            "--font-product": `var(--font-manrope), "Manrope", system-ui, sans-serif`,
            "--font-body": `var(--font-manrope), "Manrope", system-ui, sans-serif`,
            "--font-price": `var(--font-archivo), "Archivo", sans-serif`,
            "--font-order-id": `var(--font-nunito-sans), "Nunito Sans", sans-serif`,
            "--font-inter": `var(--font-inter), "Inter", system-ui, sans-serif`,
            "--font-pt-serif": `var(--font-pt-serif), "PT Serif", Georgia, serif`,
            "--font-tamil": `"Noto Serif Tamil", "Latha", serif`,
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
