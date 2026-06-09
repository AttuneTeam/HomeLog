import type { Metadata } from "next"
import { Geist, Libre_Caslon_Text, Hanken_Grotesk } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const caslon = Libre_Caslon_Text({
  variable: "--font-caslon-loaded",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
})

const grotesk = Hanken_Grotesk({
  variable: "--font-grotesk-loaded",
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Home Base",
  description: "Track your property renovations and build a comprehensive financial history.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
      </head>
      <body className={`${geist.variable} ${caslon.variable} ${grotesk.variable} font-grotesk antialiased`}>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
