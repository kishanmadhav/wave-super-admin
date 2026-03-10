"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { CheckCircle2, XCircle, Clock, RefreshCw, ArrowLeft, User, Building2, Mail, Globe, ShieldCheck, Disc3, Music } from "lucide-react"
import { toast } from "sonner"

interface AccountVerif {
  profile_id: string
  account_verification_id: string | null
  display_name: string
  account_name: string
  account_type: string
  email: string
  country: string | null
  risk_score: number
  status: string
  created_at: string
}

interface TrackRow {
  id: string
  position: number
  title: string
  duration_seconds: number | null
  duration_text: string | null
  isrc: string | null
}

interface ReleaseRow {
  id: string
  title: string
  type: string
  status: string
  primary_artist: string
  release_date: string | null
  created_at: string
  tracks: TrackRow[]
}

interface VerificationDetail {
  profile_id: string
  account_verification_id: string | null
  display_name: string
  account_name: string
  email: string
  username: string | null
  org_name: string | null
  account_type: string
  country: string | null
  timezone: string | null
  created_at: string
  verification_status: string
  risk_score: number
  profile: Record<string, unknown> | null
  artist_profile: { stage_name: string | null; legal_name: string | null; primary_genre: string | null; primary_language: string | null } | null
  label_profile: { label_name: string | null; legal_entity_name: string | null; registered_country: string | null } | null
  artists: { id: string; name: string; handle: string; bio: string | null; genres: string[] | null; location: string | null }[]
  releases?: ReleaseRow[]
}

const RISK_COLOR = (score: number) =>
  score >= 70 ? "text-destructive" : score >= 40 ? "text-warning" : "text-success"

type StatusFilter = "all" | "pending" | "verified" | "rejected" | "none"

export default function PipelinesPage() {
  const [accountVerifs, setAccountVerifs] = useState<AccountVerif[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [detailProfileId, setDetailProfileId] = useState<string | null>(null)
  const [detail, setDetail] = useState<VerificationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : ""
      const res = await api.get<{ data: AccountVerif[] }>(`/pipelines/account-verifications${params}`)
      setAccountVerifs(res.data ?? [])
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load queue")
      setAccountVerifs([])
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!detailProfileId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    api.get<VerificationDetail>(`/pipelines/creators/${detailProfileId}`)
      .then((data) => { if (!cancelled) setDetail(data) })
      .catch((e: any) => {
        if (!cancelled) {
          toast.error(e.message ?? "Failed to load details")
          setDetail(null)
        }
      })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [detailProfileId])

  async function approve(profileId: string) {
    setUpdating(true)
    try {
      await api.post(`/creators/profiles/${profileId}/verify`)
      toast.success("Verification badge awarded — creator is now verified (blue tick)")
      setDetailProfileId(null)
      setDetail(null)
      load()
    } catch (e: any) {
      toast.error(e.message ?? "Approve failed")
    }
    setUpdating(false)
  }

  async function reject(profileId: string) {
    setUpdating(true)
    try {
      await api.post(`/pipelines/creators/${profileId}/reject`)
      toast.success("Creator verification rejected")
      setDetailProfileId(null)
      setDetail(null)
      load()
    } catch (e: any) {
      toast.error(e.message ?? "Reject failed")
    }
    setUpdating(false)
  }

  return (
    <div>
      <AdminTopbar title="Pipelines" subtitle="Creator verification" />
      <div className="p-6 max-w-[1400px] space-y-4">
        {detailProfileId && (detailLoading || detail) ? (
          <>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => { setDetailProfileId(null); setDetail(null) }}>
              <ArrowLeft className="size-4" /> Back to queue
            </Button>
            {detailLoading ? (
              <Card><CardContent className="p-8"><div className="h-32 bg-muted animate-pulse rounded" /></CardContent></Card>
            ) : detail ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="size-5 text-primary" />
                      Review creator — {detail.display_name}
                    </CardTitle>
                    <Badge className={detail.verification_status === "verified" ? "bg-primary text-primary-foreground" : "bg-muted"}>{detail.verification_status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Account</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Name</dt><dd className="font-medium">{detail.display_name}</dd></div>
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Username</dt><dd>{detail.username ?? "—"}</dd></div>
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Org name</dt><dd>{detail.org_name ?? "—"}</dd></div>
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Type</dt><dd className="capitalize">{detail.account_type}</dd></div>
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Email</dt><dd className="flex items-center gap-1"><Mail className="size-3.5" />{detail.email}</dd></div>
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Country</dt><dd className="flex items-center gap-1"><Globe className="size-3.5" />{detail.country ?? "—"}</dd></div>
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Timezone</dt><dd>{detail.timezone ?? "—"}</dd></div>
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Risk score</dt><dd className={RISK_COLOR(detail.risk_score)}>{detail.risk_score}/100</dd></div>
                        <div className="flex gap-2"><dt className="text-muted-foreground w-24">Joined</dt><dd>{formatDateTime(detail.created_at)}</dd></div>
                        {(detail.profile as any)?.suspended_at != null && (
                          <div className="flex gap-2"><dt className="text-muted-foreground w-24">Suspended</dt><dd className="text-warning">{formatDateTime((detail.profile as any).suspended_at)}</dd></div>
                        )}
                        {(detail.profile as any)?.banned_at != null && (
                          <div className="flex gap-2"><dt className="text-muted-foreground w-24">Banned</dt><dd className="text-destructive">{formatDateTime((detail.profile as any).banned_at)}</dd></div>
                        )}
                        {(detail.profile as any)?.fraud_flagged && (
                          <div className="flex gap-2"><dt className="text-muted-foreground w-24">Flagged</dt><dd className="text-destructive">Fraud flagged</dd></div>
                        )}
                        {(detail.profile as any)?.deletion_pending && (
                          <div className="flex gap-2"><dt className="text-muted-foreground w-24">Deletion</dt><dd className="text-muted-foreground">Pending</dd></div>
                        )}
                      </dl>
                    </div>
                    <div className="space-y-3">
                      {detail.artist_profile && (
                        <>
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><User className="size-4" /> Artist profile</h4>
                          <dl className="space-y-2 text-sm">
                            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Stage name</dt><dd>{detail.artist_profile.stage_name ?? "—"}</dd></div>
                            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Legal name</dt><dd>{detail.artist_profile.legal_name ?? "—"}</dd></div>
                            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Genre</dt><dd>{detail.artist_profile.primary_genre ?? "—"}</dd></div>
                            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Language</dt><dd>{detail.artist_profile.primary_language ?? "—"}</dd></div>
                          </dl>
                        </>
                      )}
                      {detail.label_profile && (
                        <>
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Building2 className="size-4" /> Label profile</h4>
                          <dl className="space-y-2 text-sm">
                            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Label name</dt><dd>{detail.label_profile.label_name ?? "—"}</dd></div>
                            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Legal entity</dt><dd>{detail.label_profile.legal_entity_name ?? "—"}</dd></div>
                            <div className="flex gap-2"><dt className="text-muted-foreground w-28">Country</dt><dd>{detail.label_profile.registered_country ?? "—"}</dd></div>
                          </dl>
                        </>
                      )}
                      {detail.artists && detail.artists.length > 0 && (
                        <>
                          <h4 className="text-sm font-semibold text-foreground">Artist entities</h4>
                          <ul className="space-y-1 text-sm">
                            {detail.artists.map((a) => (
                              <li key={a.id} className="flex items-center gap-2">
                                <span className="font-medium">{a.name}</span>
                                <span className="text-muted-foreground">@{a.handle}</span>
                                {a.location && <span className="text-muted-foreground text-xs">· {a.location}</span>}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-border">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Disc3 className="size-4" /> Releases & tracks
                    </h4>
                    {detail.releases && detail.releases.length > 0 ? (
                      <div className="space-y-4">
                        {detail.releases.map((rel) => (
                          <div key={rel.id} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">{rel.title}</span>
                              <Badge variant="outline" className="text-xs capitalize">{rel.type}</Badge>
                              <Badge variant="secondary" className="text-xs capitalize">{rel.status}</Badge>
                              {rel.release_date && (
                                <span className="text-xs text-muted-foreground">{rel.release_date}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{rel.primary_artist}</p>
                            {rel.tracks && rel.tracks.length > 0 && (
                              <ul className="mt-2 space-y-1.5 pl-2 border-l-2 border-border">
                                {rel.tracks.map((t) => (
                                  <li key={t.id} className="flex items-center gap-3 text-sm">
                                    <Music className="size-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-medium min-w-0 truncate">{t.title}</span>
                                    {(t.duration_text ?? t.duration_seconds != null) && (
                                      <span className="text-muted-foreground text-xs shrink-0">
                                        {t.duration_text ?? `${Math.floor((t.duration_seconds ?? 0) / 60)}:${String((t.duration_seconds ?? 0) % 60).padStart(2, "0")}`}
                                      </span>
                                    )}
                                    {t.isrc && (
                                      <span className="text-muted-foreground text-xs font-mono shrink-0">{t.isrc}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No releases yet</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
                    <Button size="sm" className="gap-1.5" onClick={() => approve(detail.profile_id)} disabled={updating || detail.verification_status === "verified"}>
                      <ShieldCheck className="size-4" /> Award verification badge (blue tick)
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => reject(detail.profile_id)} disabled={updating}>
                      <XCircle className="size-4" /> Reject
                    </Button>
                    {detail.verification_status === "verified" && (
                      <Badge className="bg-primary text-primary-foreground">Verified — blue tick will show next to artist</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-lg border border-border bg-card px-4 py-2 text-center">
                <p className="text-lg font-bold text-foreground">{accountVerifs.length}</p>
                <p className="text-[10px] text-muted-foreground">Creators in queue</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Creator verification</CardTitle>
                <p className="text-sm text-muted-foreground">All creators from the Creators page. Review and award the verification badge (blue tick) or reject.</p>
                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} className="mt-3">
                  <TabsList className="grid w-full max-w-md grid-cols-5">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="verified">Verified</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="none">Not reviewed</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : accountVerifs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No creators match this filter</div>
                ) : (
                  <div className="space-y-3">
                    {accountVerifs.map((v) => (
                      <div
                        key={v.profile_id}
                        className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{v.display_name}</span>
                            <Badge variant="outline" className="text-xs capitalize">{v.account_type}</Badge>
                            <Badge variant={v.status === "verified" ? "default" : v.status === "rejected" ? "destructive" : "outline"} className="text-xs capitalize">{v.status.replace(/_/g, " ")}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{v.email} {v.country ? `· ${v.country}` : ""}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground"><Clock className="size-3" />{formatDateTime(v.created_at)}</span>
                            <span className={`font-medium ${RISK_COLOR(v.risk_score)}`}>Risk: {v.risk_score}/100</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDetailProfileId(v.profile_id)}>
                            Review
                          </Button>
                          <Button size="sm" className="gap-1.5" onClick={() => approve(v.profile_id)} disabled={v.status === "verified"}>
                            <CheckCircle2 className="size-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => reject(v.profile_id)}>
                            <XCircle className="size-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
