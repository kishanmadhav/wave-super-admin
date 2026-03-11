"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { WaveLogo } from "@/components/wave-logo"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  LayoutDashboard,
  Users,
  Mic2,
  Library,
  GitPullRequest,
  AlertTriangle,
  Wallet,
  Settings2,
  ScrollText,
  ChevronRight,
} from "lucide-react"

const navGroups = [
  {
    label: null,
    items: [
      { href: "/overview",  label: "Overview",    icon: LayoutDashboard },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/users",     label: "Users",       icon: Users },
      { href: "/creators",  label: "Creators",    icon: Mic2 },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/catalog",   label: "Catalog",     icon: Library },
      { href: "/pipelines", label: "Pipelines",   icon: GitPullRequest },
      { href: "/disputes",  label: "Disputes",    icon: AlertTriangle },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/wallets",   label: "Wallets & Ledger", icon: Wallet },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/system",    label: "System",      icon: Settings2 },
      { href: "/audit",     label: "Audit Log",   icon: ScrollText },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === "/overview" ? pathname === "/overview" : pathname.startsWith(href)

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        {/* Logo — same as CMS: logo only in header */}
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
          <WaveLogo />
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="size-3 text-sidebar-foreground/40" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-[10px] text-sidebar-foreground/30">Wave Super Admin v0.1</p>
        </div>
      </aside>
    </TooltipProvider>
  )
}
