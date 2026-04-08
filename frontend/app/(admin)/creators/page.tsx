"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDateTime, initials, truncate } from "@/lib/utils"
import { Search, ShieldCheck, ShieldOff, MoreHorizontal, BadgeCheck, CheckCircle2, XCircle, Clock, RefreshCw, ArrowLeft, User, Building2, Mail, Globe, Disc3, Music, Trash2 } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { api } from "@/lib/api"

interface Artist {
  id: string
  name: string
  handle: string
  location: string | null
  followers: number
  created_at: string
  profile_id: string | null
  verified?: boolean
  verification_status?: string
}

interface LabelProfile {
  id: string
  profile_id: string | null
  label_name: string | null
  legal_entity_name: string | null
  registered_country: string | null
  created_at: string
  verification_status?: string
}

interface AccountVerif {
  profile_id: string
  artist_id: string
  account_verification_id: string | null
  display_name: string
  account_name: string
  account_type: string
  email: string
  country: string | null
  status: string
  verified: boolean
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
  profile: Record<string, unknown> | null
  artist_profile: { stage_name: string | null; legal_name: string | null; primary_genre: string | null; primary_language: string | null } | null
  label_profile: { label_name: string | null; legal_entity_name: string | null; registered_country: string | null } | null
  artists: { id: string; name: string; handle: string; bio: string | null; genres: string[] | null; location: string | null }[]
  releases?: ReleaseRow[]
}

type VerifStatusFilter = "all" | "pending" | "verified" | "rejected" | "none"

export default function CreatorsPage() {
  const [search, setSearch] = useState("")

  const [artists, setArtists] = useState<Artist[]>([])
  const [labels, setLabels] = useState<LabelProfile[]>([])
  const [artistsLoading, setArtistsLoading] = useState(true)
  const [labelsLoading, setLabelsLoading] = useState(true)

  // Verification queue state
  const [accountVerifs, setAccountVerifs] = useState<AccountVerif[]>([])
  const [verifLoading, setVerifLoading] = useState(true)
  const [verifStatusFilter, setVerifStatusFilter] = useState<VerifStatusFilter>("all")
  const [detailProfileId, setDetailProfileId] = useState<string | null>(null)
  const [detail, setDetail] = useState<VerificationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [verifUpdating, setVerifUpdating] = useState(false)

  const loadArtists = useCallback(async () => {
    setArtistsLoading(true)
    try {
      const res = await api.get<{ data: Artist[] }>("/creators/artists", { search: search || undefined, limit: 50, offset: 0 })
      setArtists(res.data ?? [])
    } catch {
      setArtists([])
    } finally {
      setArtistsLoading(false)
    }
  }, [search])

  const loadLabels = useCallback(async () => {
    setLabelsLoading(true)
    try {
      const res = await api.get<{ data: LabelProfile[] }>("/creators/labels", { search: search || undefined, limit: 50, offset: 0 })
      setLabels(res.data ?? [])
    } catch {
      setLabels([])
    } finally {
      setLabelsLoading(false)
    }
  }, [search])

  useEffect(() => { loadArtists() }, [loadArtists])
  useEffect(() => { loadLabels() }, [loadLabels])

  // Verification queue loading
  const loadVerifications = useCallback(async () => {
    setVerifLoading(true)
    try {
      const params = verifStatusFilter !== "all" ? `?status=${verifStatusFilter}` : ""
      const res = await api.get<{ data: AccountVerif[] }>(`/pipelines/account-verifications${params}`)
      setAccountVerifs(res.data ?? [])
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load queue")
      setAccountVerifs([])
    }
    setVerifLoading(false)
  }, [verifStatusFilter])

  useEffect(() => { loadVerifications() }, [loadVerifications])

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

  async function approveVerification(profileId: string) {
    setVerifUpdating(true)
    try {
      await api.post(`/creators/profiles/${profileId}/verify`)
      toast.success("Verification badge awarded — creator is now verified (blue tick)")
      setDetailProfileId(null)
      setDetail(null)
      loadVerifications()
    } catch (e: any) {
      toast.error(e.message ?? "Approve failed")
    }
    setVerifUpdating(false)
  }

  async function rejectVerification(profileId: string) {
    setVerifUpdating(true)
    try {
      await api.post(`/pipelines/creators/${profileId}/reject`)
      toast.success("Creator verification rejected")
      setDetailProfileId(null)
      setDetail(null)
      loadVerifications()
    } catch (e: any) {
      toast.error(e.message ?? "Reject failed")
    }
    setVerifUpdating(false)
  }

  async function disableArtist(artistId: string) {
    const reason = prompt("Disable reason?", "Disabled by admin")
    if (!reason) return
    try {
      await api.post(`/creators/artists/${artistId}/disable`, { reason })
      toast.success("Artist account disabled")
      loadArtists()
    } catch (e: any) {
      toast.error(e.message ?? "Disable failed")
    }
  }

  async function deleteArtist(artistId: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete artist "${name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/creators/artists/${artistId}`)
      toast.success("Artist deleted")
      loadArtists()
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed")
    }
  }

  async function disableLabel(labelId: string) {
    const reason = prompt("Disable reason?", "Disabled by admin")
    if (!reason) return
    try {
      await api.post(`/creators/labels/${labelId}/disable`, { reason })
      toast.success("Label account disabled")
      loadLabels()
    } catch (e: any) {
      toast.error(e.message ?? "Disable failed")
    }
  }

  async function deleteLabel(labelId: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete label "${name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/creators/labels/${labelId}`)
      toast.success("Label deleted")
      loadLabels()
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed")
    }
  }

  return (
    <div>
      <AdminTopbar title="Creators" subtitle="Manage artists, labels & verification" />
      <div className="p-6 max-w-[1400px] space-y-4">
        <Tabs defaultValue="artists">
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="artists">Artists ({artists.length})</TabsTrigger>
              <TabsTrigger value="labels">Labels ({labels.length})</TabsTrigger>
              <TabsTrigger value="verification">Verification ({accountVerifs.length})</TabsTrigger>
            </TabsList>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search artists, labels…"
                className="pl-8 h-8 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ── Artists Tab ── */}
          <TabsContent value="artists" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Artist</TableHead>
                      <TableHead>Handle</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Followers</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {artistsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><div className="h-5 rounded bg-muted animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : artists.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground text-sm">No artists found</TableCell>
                      </TableRow>
                    ) : artists.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-7 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(a.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium inline-flex items-center gap-1.5">
                                {truncate(a.name, 28)}
                                {a.verification_status === "verified" && (
                                  <BadgeCheck className="size-4 shrink-0 text-blue-500" aria-label="Verified" />
                                )}
                              </span>
                              <div className="mt-0.5 flex gap-1.5">
                                {a.verification_status === "verified" ? (
                                  <Badge variant="secondary" className="text-[10px] text-blue-600 border-blue-500/30">Verified</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] capitalize">{a.verification_status ?? "unverified"}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">@{a.handle}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{a.location ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{a.followers.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatDateTime(a.created_at)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {a.profile_id && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/creators/${a.profile_id}`}>View detail</Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!a.profile_id) return toast.error("Artist has no linked profile")
                                  api.post(`/creators/profiles/${a.profile_id}/verify`).then(() => { toast.success("Verified"); loadArtists() }).catch((e: any) => toast.error(e.message))
                                }}
                              >
                                <ShieldCheck className="mr-2 size-4" />Verify
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!a.profile_id) return toast.error("Artist has no linked profile")
                                  api.post(`/creators/profiles/${a.profile_id}/unverify`).then(() => { toast.info("Unverified"); loadArtists() }).catch((e: any) => toast.error(e.message))
                                }}
                              >
                                <ShieldOff className="mr-2 size-4" />Unverify
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-warning"
                                onClick={() => disableArtist(a.id)}
                              >
                                <ShieldOff className="mr-2 size-4" />Disable account
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => deleteArtist(a.id, a.name)}
                              >
                                <Trash2 className="mr-2 size-4" />Delete artist
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Labels Tab ── */}
          <TabsContent value="labels" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Label</TableHead>
                      <TableHead>Legal Entity</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labelsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><div className="h-5 rounded bg-muted animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : labels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-sm">No labels found</TableCell>
                      </TableRow>
                    ) : labels.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.label_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{l.legal_entity_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{l.registered_country ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatDateTime(l.created_at)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {l.profile_id && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/creators/${l.profile_id}`}>View detail</Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-warning"
                                onClick={() => disableLabel(l.id)}
                              >
                                <ShieldOff className="mr-2 size-4" />Disable account
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => deleteLabel(l.id, l.label_name ?? "this label")}
                              >
                                <Trash2 className="mr-2 size-4" />Delete label
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Verification Tab ── */}
          <TabsContent value="verification" className="mt-4 space-y-4">
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
                        <Button size="sm" className="gap-1.5" onClick={() => approveVerification(detail.profile_id)} disabled={verifUpdating || detail.verification_status === "verified"}>
                          <ShieldCheck className="size-4" /> Award verification badge (blue tick)
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => rejectVerification(detail.profile_id)} disabled={verifUpdating}>
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
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={loadVerifications}>
                    <RefreshCw className="size-3.5" /> Refresh
                  </Button>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Creator verification</CardTitle>
                    <p className="text-sm text-muted-foreground">Review and award the verification badge (blue tick) or reject.</p>
                    <Tabs value={verifStatusFilter} onValueChange={(v) => setVerifStatusFilter(v as VerifStatusFilter)} className="mt-3">
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
                    {verifLoading ? (
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
                            key={v.artist_id}
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
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDetailProfileId(v.profile_id)}>
                                Review
                              </Button>
                              <Button size="sm" className="gap-1.5" onClick={() => approveVerification(v.profile_id)} disabled={v.status === "verified"}>
                                <CheckCircle2 className="size-3.5" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => rejectVerification(v.profile_id)}>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
