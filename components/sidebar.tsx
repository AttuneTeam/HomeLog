"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, Building2, LogOut, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/financial", label: "Financial Position", icon: TrendingUp },
]

interface SidebarProps {
  displayName: string
}

export function Sidebar({ displayName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Failed to sign out")
      return
    }
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen border-r bg-background px-3 py-4 shrink-0">
      <div className="flex items-center gap-2 px-2 mb-6">
        <Home className="h-5 w-5" />
        <span className="font-bold text-lg tracking-tight">Home Base</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href || (href !== "/" && pathname.startsWith(href))
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t pt-3 mt-3">
        <p className="px-3 py-1 text-xs text-muted-foreground truncate">{displayName}</p>
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
  )
}
