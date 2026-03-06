"use client"

import { useEffect, useState } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { formatDateTime } from "@/lib/utils"
import { CheckCircle2, XCircle, MessageSquare, Clock, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface AccountVerif {
  id: string; account_name: string; account_type: string; email: string
  country: string | null; risk_score: number; status: string; created_at: string
}
interface ReleaseVerif {
  id: string; title: string; artist: string; type: string
  track_count: number; status: string; has_active_dispute: boolean; created_at: string
}

const RISK_COLOR = (score: number) =>
  score >= 70 ? "text-destructive" : score >= 40 ? "text-warning" : "text-success"

export default function PipelinesPage() {
  const [accountVerifs, setAccountVerifs] = useState<AccountVerif[]>([])
  const [releaseVerifs, setReleaseVerifs]   = useState<ReleaseVerif[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [av, rv] = await Promise.all([
      supabase.from("account_verifications")
        .select("id,account_name,account_type,email,country,risk_score,status,created_at")
        .in("status", ["created", "submitted", "maker_approved"])
        .order("created_at", { ascending: true })
        .limit(50),
      supabase.from("release_verifications")
        .select("id,title,artist,type,track_count,status,has_active_dispute,created_at")
        .in("status", ["submitted", "maker_approved"])
        .order("created_at", { ascending: true })
        .limit(50),
    ])
    setAccountVerifs(av.data ?? [])
    setReleaseVerifs(rv.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function approveAccount(id: string) {
    await supabase.from("account_verifications").update({ status: "verified" }).eq("id", id)
    toast.success("Account verified")
    load()
  }
  async function rejectAccount(id: string) {
    await supabase.from("account_verifications").update({ status: "rejected" }).eq("id", id)
    toast.error("Account rejected")
    load()
  }
  async function approveRelease(id: string) {
    await supabase.from("release_verifications").update({ status: "checker_approved" }).eq("id", id)
    toast.success("Release approved")
    load()
  }
  async function rejectRelease(id: string) {
    await supabase.from("release_verifications").update({ status: "rejected" }).eq("id", id)
    toast.error("Release rejected")
    load()
  }

  return (
    <div>
      <AdminTopbar title="Pipelines" subtitle="Verification & review queues" />
      <div className="p-6 max-w-[1400px] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
              <p className="text-lg font-bold text-foreground">{accountVerifs.length}</p>
              <p className="text-[10px] text-muted-foreground">Creator Verif.</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
              <p className="text-lg font-bold text-foreground">{releaseVerifs.length}</p>
              <p className="text-[10px] text-muted-foreground">Release Review</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="creator">
          <TabsList>
            <TabsTrigger value="creator">Creator Verification ({accountVerifs.length})</TabsTrigger>
            <TabsTrigger value="release">Release Review ({releaseVerifs.length})</TabsTrigger>
          </TabsList>

          {/* Creator Verification */}
          <TabsContent value="creator" className="mt-4">
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><div className="h-12 bg-secondary animate-pulse rounded" /></CardContent></Card>
                ))
              ) : accountVerifs.length === 0 ? (
                <Card><CardContent className="p-12 text-center text-muted-foreground text-sm">Queue is empty ✓</CardContent></Card>
              ) : accountVerifs.map(v => (
                <Card key={v.id} className="hover:border-border/80 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{v.account_name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{v.account_type}</Badge>
                          <Badge variant={
                            v.status === "submitted" ? "secondary" :
                            v.status === "maker_approved" ? "default" : "outline"
                          } className="text-xs capitalize">{v.status.replace(/_/g, " ")}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{v.email} {v.country ? `· ${v.country}` : ""}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="size-3" />{formatDateTime(v.created_at)}
                          </span>
                          <span className={`font-medium ${RISK_COLOR(v.risk_score)}`}>
                            Risk: {v.risk_score}/100
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground" onClick={() => toast.info("Request info — coming soon")}>
                          <MessageSquare className="size-3.5" /> Request Info
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => rejectAccount(v.id)}>
                          <XCircle className="size-3.5" /> Reject
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={() => approveAccount(v.id)}>
                          <CheckCircle2 className="size-3.5" /> Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Release Review */}
          <TabsContent value="release" className="mt-4">
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><div className="h-12 bg-secondary animate-pulse rounded" /></CardContent></Card>
                ))
              ) : releaseVerifs.length === 0 ? (
                <Card><CardContent className="p-12 text-center text-muted-foreground text-sm">Queue is empty ✓</CardContent></Card>
              ) : releaseVerifs.map(r => (
                <Card key={r.id} className={`transition-colors ${r.has_active_dispute ? "border-warning/40" : "hover:border-border/80"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{r.title}</span>
                          <Badge variant="outline" className="text-xs capitalize">{r.type}</Badge>
                          <Badge variant="secondary" className="text-xs capitalize">{r.status.replace(/_/g, " ")}</Badge>
                          {r.has_active_dispute && (
                            <Badge variant="destructive" className="text-xs">Active Dispute</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{r.artist} · {r.track_count} track{r.track_count !== 1 ? "s" : ""}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="size-3" />{formatDateTime(r.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground" onClick={() => toast.info("Request changes — coming soon")}>
                          <MessageSquare className="size-3.5" /> Changes
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => rejectRelease(r.id)}>
                          <XCircle className="size-3.5" /> Reject
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={() => approveRelease(r.id)} disabled={r.has_active_dispute}>
                          <CheckCircle2 className="size-3.5" /> Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
