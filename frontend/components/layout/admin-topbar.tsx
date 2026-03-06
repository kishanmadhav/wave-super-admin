"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Bell, LogOut, ShieldCheck, Zap } from "lucide-react"
import { signOut } from "@/lib/auth"
import { initials } from "@/lib/utils"

interface TopbarProps {
  title: string
  subtitle?: string
}

export function AdminTopbar({ title, subtitle }: TopbarProps) {
  const router = useRouter()
  const [adminEmail, setAdminEmail] = useState("")
  const [adminRole, setAdminRole] = useState("")

  useEffect(() => {
    import("@/lib/auth").then(({ getAdminIdentity }) => {
      getAdminIdentity().then(identity => {
        if (identity) {
          setAdminEmail(identity.email)
          setAdminRole(identity.role)
        }
      })
    })
  }, [])

  async function handleSignOut() {
    await signOut()
    router.push("/login")
    toast.info("Signed out")
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3 gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users, releases, disputes…"
            className="w-64 pl-8 h-8 text-sm bg-secondary border-0"
          />
        </div>

        {/* Quick action */}
        <Button variant="outline" size="sm" className="hidden md:flex gap-1.5">
          <Zap className="size-3.5 text-warning" />
          Quick Action
        </Button>

        {/* Alerts */}
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
        </Button>

        {/* Admin menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/15 text-primary text-xs">
                  {initials(adminEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-xs text-foreground font-medium leading-tight">{adminEmail || "Admin"}</p>
                <p className="text-[10px] text-muted-foreground leading-tight capitalize">{adminRole || "admin"}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">{adminEmail}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck className="size-3 text-primary" />
                <p className="text-xs text-muted-foreground capitalize">{adminRole}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
