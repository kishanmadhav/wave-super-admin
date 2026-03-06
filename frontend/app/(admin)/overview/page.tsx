"use client"

import { useEffect, useState } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { formatNumber } from "@/lib/utils"
import {
  Users, Disc3, AlertTriangle, ShieldCheck,
  TrendingUp, Clock, Zap, CheckCircle2,
  XCircle, Activity, ArrowRight, RefreshCw,
} from "lucide-react"
import Link from "next/link"

interface Stats {
  totalProfiles: number
  pendingVerifications: number
  pendingReleaseReviews: number
  openDisputes: number
  activeRooms: number
  totalReleases: number
}

const ALERT_ITEMS = [
  { type: "warning", msg: "Transcoding failure spike detected — 14 assets stuck", time: "3 min ago" },
  { type: "info",    msg: "Creator verification surge: +28 submissions in 1h",      time: "12 min ago" },
  { type: "critical",msg: "Seek spam cluster detected — 3 user sessions flagged",   time: "18 min ago" },
  { type: "info",    msg: "Emission rate stable — 1.02 Nano/sec avg",               time: "1 hr ago" },
]

const QUICK_ACTIONS = [
  { label: "Approve next 5 verifications", href: "/pipelines",  icon: CheckCircle2, variant: "default" as const },
  { label: "Export ledger (24h)",           href: "/wallets",    icon: Zap,          variant: "outline" as const },
  { label: "View flagged sessions",         href: "/wallets",    icon: Activity,     variant: "outline" as const },
  { label: "Post announcement",             href: "/system",     icon: TrendingUp,   variant: "outline" as const },
]

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats>({
    totalProfiles: 0, pendingVerifications: 0, pendingReleaseReviews: 0,
    openDisputes: 0, activeRooms: 0, totalReleases: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [profiles, verifs, releaseVerifs, disputes, rooms, releases] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("account_verifications").select("id", { count: "exact", head: true }).in("status", ["created", "submitted"]),
        supabase.from("release_verifications").select("id", { count: "exact", head: true }).in("status", ["submitted", "maker_approved"]),
        supabase.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open", "under_review", "escalated"]),
        supabase.from("rooms").select("id", { count: "exact", head: true }).eq("status", "live"),
        supabase.from("releases").select("id", { count: "exact", head: true }),
      ])
      setStats({
        totalProfiles: profiles.count ?? 0,
        pendingVerifications: verifs.count ?? 0,
        pendingReleaseReviews: releaseVerifs.count ?? 0,
        openDisputes: disputes.count ?? 0,
        activeRooms: rooms.count ?? 0,
        totalReleases: releases.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const kpiCards = [
    { label: "Total Users",            value: stats.totalProfiles,         icon: Users,       href: "/users",     delta: "+12 today" },
    { label: "Pending Verifications",  value: stats.pendingVerifications,  icon: ShieldCheck, href: "/pipelines", delta: "needs review", urgent: stats.pendingVerifications > 0 },
    { label: "Release Reviews",        value: stats.pendingReleaseReviews, icon: Disc3,       href: "/pipelines", delta: "in queue",    urgent: stats.pendingReleaseReviews > 0 },
    { label: "Open Disputes",          value: stats.openDisputes,          icon: AlertTriangle, href: "/disputes", delta: "unresolved", urgent: stats.openDisputes > 0 },
    { label: "Live Rooms",             value: stats.activeRooms,           icon: Activity,    href: "/catalog",   delta: "right now" },
    { label: "Total Releases",         value: stats.totalReleases,         icon: TrendingUp,  href: "/catalog",   delta: "all time" },
  ]

  return (
    <div>
      <AdminTopbar title="Overview" subtitle="Platform operations cockpit" />
      <div className="p-6 space-y-6 max-w-[1400px]">

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.label} href={card.href}>
                <Card className={`hover:border-primary/50 transition-colors cursor-pointer ${card.urgent ? "border-warning/40" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Icon className={`size-4 ${card.urgent ? "text-warning" : "text-muted-foreground"}`} />
                      {card.urgent && <div className="size-1.5 rounded-full bg-warning animate-pulse" />}
                    </div>
                    <p className="text-2xl font-bold text-foreground">{loading ? "—" : formatNumber(card.value)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{card.delta}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operational Alerts */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Operational Alerts</h2>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5">
                <RefreshCw className="size-3" /> Refresh
              </Button>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {ALERT_ITEMS.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className={`mt-0.5 size-2 rounded-full shrink-0 ${
                      a.type === "critical" ? "bg-destructive" :
                      a.type === "warning"  ? "bg-warning" : "bg-primary"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{a.msg}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${
                      a.type === "critical" ? "border-destructive/40 text-destructive" :
                      a.type === "warning"  ? "border-warning/40 text-warning" : ""
                    }`}>{a.type}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
            <Card>
              <CardContent className="p-3 space-y-2">
                {QUICK_ACTIONS.map((qa) => {
                  const Icon = qa.icon
                  return (
                    <Link key={qa.label} href={qa.href}>
                      <Button variant={qa.variant} className="w-full justify-start gap-2 text-sm h-9">
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate text-left">{qa.label}</span>
                        <ArrowRight className="size-3 ml-auto shrink-0 text-muted-foreground" />
                      </Button>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>

            {/* Queue Summary */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Queue Status</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {[
                  { label: "Creator Verification", count: stats.pendingVerifications, urgent: true },
                  { label: "Release Review",        count: stats.pendingReleaseReviews, urgent: true },
                  { label: "Open Disputes",         count: stats.openDisputes, urgent: stats.openDisputes > 2 },
                  { label: "Live Rooms",            count: stats.activeRooms, urgent: false },
                ].map((q) => (
                  <div key={q.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{q.label}</span>
                    <Badge variant={q.urgent && q.count > 0 ? "destructive" : "secondary"} className="text-xs">
                      {loading ? "—" : q.count}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
