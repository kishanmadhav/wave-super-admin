"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { api } from "@/lib/api"
import { formatDateTime, initials } from "@/lib/utils"
import {
  ArrowLeft, Mail, Globe, Calendar, ShieldCheck, UserX, Flag,
  Wallet, MessageSquare, ScrollText, AlertTriangle, Copy, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"

interface Profile {
  id: string; email: string; username: string | null; phone: string | null
  account_type: string | null; org_name: string | null; country: string | null
  timezone: string; onboarding_completed: boolean; two_factor_enabled: boolean
  deletion_pending: boolean; fraud_flagged: boolean | null
  suspended_at: string | null; suspended_reason: string | null
  banned_at: string | null; created_at: string; updated_at: string
  display_name?: string
}

interface Release { id: string; title: string; status: string; created_at: string }
interface Dispute { id: string; type: string; status: string; created_at: string }
interface LedgerEntry { id: string; source: string; nano_delta: number; mini_delta: number; created_at: string }

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [releases, setReleases] = useState<Release[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [p, r, d, l] = await Promise.all([
          api.get<Profile>(`/users/${id}`),
          api.get<Release[]>(`/users/${id}/releases`),
          api.get<Dispute[]>(`/users/${id}/disputes`),
          api.get<LedgerEntry[]>(`/users/${id}/ledger`),
        ])
        setProfile(p)
        setReleases(r ?? [])
        setDisputes(d ?? [])
        setLedger(l ?? [])
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load user")
        setProfile(null)
        setReleases([])
        setDisputes([])
        setLedger([])
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function suspend() {
    const reason = prompt("Suspend reason?", "Suspended by admin") ?? ""
    if (!reason) return
    try {
      await api.post(`/users/${id}/suspend`, { reason })
      toast.success("User suspended")
      const p = await api.get<Profile>(`/users/${id}`)
      setProfile(p)
    } catch (e: any) {
      toast.error(e.message ?? "Suspend failed")
    }
  }

  async function unsuspend() {
    try {
      await api.post(`/users/${id}/unsuspend`)
      toast.success("User re-enabled")
      const p = await api.get<Profile>(`/users/${id}`)
      setProfile(p)
    } catch (e: any) {
      toast.error(e.message ?? "Unsuspend failed")
    }
  }

  async function ban() {
    const reason = prompt("Ban reason?", "Banned by admin") ?? ""
    if (!reason) return
    try {
      await api.post(`/users/${id}/ban`, { reason })
      toast.success("User banned")
      const p = await api.get<Profile>(`/users/${id}`)
      setProfile(p)
    } catch (e: any) {
      toast.error(e.message ?? "Ban failed")
    }
  }

  async function flagFraud() {
    try {
      await api.post(`/users/${id}/flag-fraud`)
      toast.success("User flagged for fraud")
      const p = await api.get<Profile>(`/users/${id}`)
      setProfile(p)
    } catch (e: any) {
      toast.error(e.message ?? "Flag failed")
    }
  }

  if (loading) return (
    <div>
      <AdminTopbar title="Creator Detail" />
      <div className="p-6 flex items-center justify-center min-h-64 text-muted-foreground">Loading…</div>
    </div>
  )

  if (!profile) return (
    <div>
      <AdminTopbar title="Creator Not Found" />
      <div className="p-6 text-muted-foreground">No creator found with this ID.</div>
    </div>
  )

  const displayName = profile.display_name ?? profile.username ?? profile.email
  const status = profile.banned_at ? "banned" : profile.suspended_at ? "suspended" : profile.fraud_flagged ? "flagged" : "active"

  return (
    <div>
      <AdminTopbar title="Creator Detail" />
      <div className="p-6 max-w-[1200px] space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => router.push("/users")} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to Creators
        </Button>

        {/* Header card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  <AvatarFallback className="bg-primary/15 text-primary text-lg">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
                    <Badge variant={status === "active" ? "secondary" : "destructive"} className="capitalize text-xs">{status}</Badge>
                    {profile.account_type && <Badge variant="outline" className="capitalize text-xs">{profile.account_type}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Globe className="size-3" />{profile.country ?? "—"}</span>
                    <span className="flex items-center gap-1"><Calendar className="size-3" />Joined {formatDateTime(profile.created_at)}</span>
                    <button onClick={() => { navigator.clipboard.writeText(profile.id); toast.success("ID copied") }}
                      className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <Copy className="size-3" />{profile.id.slice(0, 8)}…
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Impersonate — coming soon")}>
                  <ExternalLink className="size-3.5" /> Impersonate
                </Button>
                {profile.suspended_at ? (
                  <Button variant="outline" size="sm" className="gap-1.5 text-warning border-warning/40 hover:bg-warning/10" onClick={unsuspend}>
                    <UserX className="size-3.5" /> Re-enable
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5 text-warning border-warning/40 hover:bg-warning/10" onClick={suspend}>
                    <UserX className="size-3.5" /> Suspend
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={flagFraud}>
                  <Flag className="size-3.5" /> Flag
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={ban}>
                  <ShieldCheck className="size-3.5" /> Ban
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Message — coming soon")}>
                  <MessageSquare className="size-3.5" /> Message
                </Button>
              </div>
            </div>

            {/* Quick meta */}
            <Separator className="my-4" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Org / Display name</p>
                <p className="text-foreground font-medium">{profile.org_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">2FA enabled</p>
                <p className={profile.two_factor_enabled ? "text-success font-medium" : "text-muted-foreground"}>
                  {profile.two_factor_enabled ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Onboarding</p>
                <p className={profile.onboarding_completed ? "text-success font-medium" : "text-warning font-medium"}>
                  {profile.onboarding_completed ? "Complete" : "Incomplete"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-foreground">{profile.phone ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="releases">
          <TabsList>
            <TabsTrigger value="releases">Releases ({releases.length})</TabsTrigger>
            <TabsTrigger value="ledger">Ledger ({ledger.length})</TabsTrigger>
            <TabsTrigger value="disputes">Disputes ({disputes.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="releases" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {releases.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12 text-sm">No releases</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/20">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Title</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {releases.map(r => (
                        <tr key={r.id} className="hover:bg-secondary/10">
                          <td className="px-4 py-2.5 font-medium text-foreground">{r.title}</td>
                          <td className="px-4 py-2.5"><Badge variant="secondary" className="text-xs capitalize">{r.status}</Badge></td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDateTime(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {ledger.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12 text-sm">No ledger entries</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/20">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Source</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Nano Δ</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Mini Δ</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledger.map(e => (
                        <tr key={e.id} className="hover:bg-secondary/10">
                          <td className="px-4 py-2.5 capitalize text-muted-foreground">{e.source}</td>
                          <td className={`px-4 py-2.5 font-mono text-xs font-medium ${e.nano_delta >= 0 ? "text-success" : "text-destructive"}`}>
                            {e.nano_delta >= 0 ? "+" : ""}{e.nano_delta}
                          </td>
                          <td className={`px-4 py-2.5 font-mono text-xs font-medium ${e.mini_delta >= 0 ? "text-success" : "text-destructive"}`}>
                            {e.mini_delta >= 0 ? "+" : ""}{e.mini_delta}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDateTime(e.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disputes" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {disputes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12 text-sm">No disputes</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/20">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Type</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Raised</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {disputes.map(d => (
                        <tr key={d.id} className="hover:bg-secondary/10">
                          <td className="px-4 py-2.5 capitalize">{d.type.replace(/_/g, " ")}</td>
                          <td className="px-4 py-2.5"><Badge variant="secondary" className="text-xs capitalize">{d.status}</Badge></td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDateTime(d.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <Link href={`/disputes/${d.id}`} className="text-xs text-primary hover:underline">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                Internal notes feature — available once schema-4 is deployed.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
