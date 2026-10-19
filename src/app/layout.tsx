import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { getPublicEnv } from "@/lib/env";

import "./globals.css";

// Mongolian Ө/Ү are in the cyrillic-ext range, not the basic cyrillic subset.
const inter = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
    metadataBase: new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The nonce-based CSP (src/proxy.ts) needs every page rendered per request.
  await connection();

  return (
    <html lang="mn" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Makes messages/mn.json available to client components. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
