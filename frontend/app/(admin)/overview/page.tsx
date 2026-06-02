"use client"

import { useEffect, useState } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { formatNumber } from "@/lib/utils"
import {
  Users, Disc3, AlertTriangle, ShieldCheck,
  TrendingUp, Zap, CheckCircle2,
  Activity, ArrowRight, RefreshCw,
} from "lucide-react"
import Link from "next/link"

interface Stats {
  mobileUsers: number
  creators: number
  pendingVerifications: number
  pendingReleaseReviews: number
  openDisputes: number
  activeRooms: number
  totalReleases: number
}

interface Alert {
  type: "critical" | "warning" | "info"
  msg: string
  time: string
  href?: string
}

const QUICK_ACTIONS = [
  { label: "Review pending verifications", href: "/creators", icon: CheckCircle2, variant: "default" as const },
  { label: "Review release queue",         href: "/catalog",  icon: Zap,          variant: "outline" as const },
  { label: "Resolve open disputes",        href: "/disputes", icon: Activity,     variant: "outline" as const },
  { label: "System settings",              href: "/system",   icon: TrendingUp,   variant: "outline" as const },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return "just now"
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats>({
    mobileUsers: 0, creators: 0, pendingVerifications: 0, pendingReleaseReviews: 0,
    openDisputes: 0, activeRooms: 0, totalReleases: 0,
  })
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [mobileUsers, creators, verifs, releaseVerifs, disputes, rooms, releases, recentVerifs, recentDisputes, recentFlagged] = await Promise.all([
      supabase.from("mobile_users").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("account_verifications").select("id", { count: "exact", head: true }).in("status", ["created", "submitted"]),
      supabase.from("releases").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
      supabase.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open", "under_review", "escalated"]),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("status", "live"),
      supabase.from("releases").select("id", { count: "exact", head: true }).neq("status", "draft"),
      // Recent submitted verifications (last 24h) for alerts
      supabase.from("account_verifications")
        .select("id,created_at")
        .in("status", ["created", "submitted"])
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(5),
      // Recent open disputes for alerts
      supabase.from("disputes")
        .select("id,created_at,status")
        .in("status", ["open", "escalated"])
        .order("created_at", { ascending: false })
        .limit(5),
      // Fraud-flagged profiles (recent)
      supabase.from("profiles")
        .select("id,email,username,updated_at")
        .eq("fraud_flagged", true)
        .order("updated_at", { ascending: false })
        .limit(5),
    ])

    setStats({
      mobileUsers: mobileUsers.count ?? 0,
      creators: creators.count ?? 0,
      pendingVerifications: verifs.count ?? 0,
      pendingReleaseReviews: releaseVerifs.count ?? 0,
      openDisputes: disputes.count ?? 0,
      activeRooms: rooms.count ?? 0,
      totalReleases: releases.count ?? 0,
    })

    // Build live operational alerts from real events
    const nextAlerts: Alert[] = []
    const verifCount = recentVerifs.data?.length ?? 0
    if (verifCount > 0) {
      const newest = recentVerifs.data![0].created_at as string
      nextAlerts.push({
        type: verifCount >= 5 ? "warning" : "info",
        msg: `${verifCount} creator verification${verifCount === 1 ? "" : "s"} awaiting review`,
        time: timeAgo(newest),
        href: "/creators",
      })
    }
    const escalatedCount = (recentDisputes.data ?? []).filter((d: any) => d.status === "escalated").length
    if (escalatedCount > 0) {
      const newest = (recentDisputes.data ?? []).find((d: any) => d.status === "escalated")?.created_at as string
      nextAlerts.push({
        type: "critical",
        msg: `${escalatedCount} dispute${escalatedCount === 1 ? "" : "s"} escalated — immediate attention`,
        time: timeAgo(newest),
        href: "/disputes",
      })
    }
    const openDisputeCount = (recentDisputes.data ?? []).filter((d: any) => d.status === "open").length
    if (openDisputeCount > 0) {
      const newest = (recentDisputes.data ?? []).find((d: any) => d.status === "open")?.created_at as string
      nextAlerts.push({
        type: "warning",
        msg: `${openDisputeCount} open dispute${openDisputeCount === 1 ? "" : "s"} pending`,
        time: timeAgo(newest),
        href: "/disputes",
      })
    }
    const flaggedCount = recentFlagged.data?.length ?? 0
    if (flaggedCount > 0) {
      const newest = recentFlagged.data![0].updated_at as string
      nextAlerts.push({
        type: "critical",
        msg: `${flaggedCount} account${flaggedCount === 1 ? "" : "s"} flagged for fraud`,
        time: timeAgo(newest),
        href: "/creators",
      })
    }
    setAlerts(nextAlerts)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kpiCards = [
    { label: "Mobile Users",           value: stats.mobileUsers,           icon: Users,       href: "/users",     delta: "listeners" },
    { label: "Creators",               value: stats.creators,              icon: ShieldCheck, href: "/creators",  delta: "artists & labels" },
    { label: "Pending Verifications",  value: stats.pendingVerifications,  icon: ShieldCheck, href: "/creators",  delta: "needs review", urgent: stats.pendingVerifications > 0 },
    { label: "Release Reviews",        value: stats.pendingReleaseReviews, icon: Disc3,       href: "/catalog",   delta: "in queue",     urgent: stats.pendingReleaseReviews > 0 },
    { label: "Open Disputes",          value: stats.openDisputes,          icon: AlertTriangle, href: "/disputes", delta: "unresolved",  urgent: stats.openDisputes > 0 },
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
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={() => { setLoading(true); load() }}>
                <RefreshCw className="size-3" /> Refresh
              </Button>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {loading ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading alerts…</div>
                ) : alerts.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <CheckCircle2 className="size-6 text-success mx-auto mb-2" />
                    <p className="text-sm text-foreground">All clear</p>
                    <p className="text-xs text-muted-foreground mt-1">No operational alerts right now</p>
                  </div>
                ) : (
                  alerts.map((a, i) => {
                    const body = (
                      <div className="flex items-start gap-3 px-4 py-3">
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
                    )
                    return a.href ? (
                      <Link key={i} href={a.href} className="block hover:bg-muted/30 transition-colors">
                        {body}
                      </Link>
                    ) : (
                      <div key={i}>{body}</div>
                    )
                  })
                )}
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
