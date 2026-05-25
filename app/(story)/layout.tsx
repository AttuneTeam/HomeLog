import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Libre_Caslon_Text, Hanken_Grotesk } from "next/font/google";

const caslon = Libre_Caslon_Text({
  variable: "--font-caslon-loaded",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const grotesk = Hanken_Grotesk({
  variable: "--font-grotesk-loaded",
  weight: ["300", "400", "500", "600", "700", "900"],
  subsets: ["latin"],
});

export default async function StoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className={`${caslon.variable} ${grotesk.variable}`}>
      {children}
    </div>
  );
}
