"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut, TrendingUp, Sun, Moon, UserCircle, X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTheme } from "next-themes";

const navItems = [
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/financial", label: "Financial Position", icon: TrendingUp },
  { href: "/settings/account", label: "Account", icon: UserCircle },
];

interface SidebarProps {
  displayName: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ displayName, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "flex flex-col w-60 h-screen border-r bg-background px-3 py-4 shrink-0 transition-transform duration-300",
        "fixed inset-y-0 left-0 z-30 md:sticky md:top-0 md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex items-center justify-between px-2 mb-6">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Home Base" width={120} height={94} className="h-8 w-auto" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden -mr-1"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t pt-3 mt-3">
        <p className="px-3 py-1 text-xs text-muted-foreground truncate">
          {displayName}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground mt-1"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground mt-1"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
