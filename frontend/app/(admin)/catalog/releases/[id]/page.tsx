"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { toast } from "sonner"
import {
  ArrowLeft,
  Disc3,
  FileText,
  Music,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Ban,
  Image as ImageIcon,
} from "lucide-react"

interface TrackRow {
  id: string
  title: string
  primary_artist: string | null
  isrc: string | null
  file_url: string | null
  file_name: string | null
  upload_status: string
  explicit: string
  p_line: string | null
  c_line: string | null
  lyrics: string | null
  duration_text: string | null
}

interface ReleaseDetail {
  id: string
  title: string
  primary_artist: string
  status: string
  type: string
  release_date: string | null
  cover_art_url: string | null
  label: string | null
  primary_genre: string | null
  primary_language: string | null
  reviewer_comment: string | null
  has_active_dispute: boolean
  confirm_rights: boolean
  confirm_credits: boolean
  distribution_wave: boolean
  distribution_external: boolean
  rights_type: string | null
  license_evidence_url: string | null
  created_at: string
  updated_at: string
  tracks: TrackRow[]
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/15 text-primary",
  under_review: "bg-primary/15 text-primary",
  approved: "bg-success/15 text-success",
  published: "bg-success/15 text-success",
  changes_requested: "bg-warning/15 text-warning",
  rejected: "bg-destructive/15 text-destructive",
  takedown: "bg-destructive/15 text-destructive",
}

const explicitLabel: Record<string, string> = {
  explicit: "Explicit",
  not_explicit: "Clean",
  clean: "Clean",
}

function formatStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

type ActionType = "approve" | "request_changes" | "reject" | "force_publish" | "takedown"

export default function CatalogReleaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [release, setRelease] = useState<ReleaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionType, setActionType] = useState<ActionType | null>(null)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    api
      .get<ReleaseDetail>(`/catalog/releases/${id}`)
      .then((data) => {
        if (!cancelled) setRelease(data)
      })
      .catch((e: any) => {
        if (!cancelled) {
          toast.error(e.message ?? "Failed to load release")
          setRelease(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const runAction = async () => {
    if (!release || !id) return
    if (!comment.trim()) {
      toast.error("Comment is required for all actions")
      return
    }
    setSubmitting(true)
    try {
      if (actionType === "force_publish") {
        await api.post(`/catalog/releases/${id}/force-publish`, { comment: comment.trim() })
        toast.success("Release force published")
      } else if (actionType === "takedown") {
        await api.post(`/catalog/releases/${id}/takedown`, { comment: comment.trim() })
        toast.success("Release taken down")
      } else {
        const statusMap = {
          approve: "approved",
          request_changes: "changes_requested",
          reject: "rejected",
        } as const
        const status = actionType ? statusMap[actionType] : null
        if (status) {
          await api.patch(`/catalog/releases/${id}/status`, { status, comment: comment.trim() })
          toast.success(`Release ${formatStatus(status)}`)
        }
      }
      setActionType(null)
      setComment("")
      const updated = await api.get<ReleaseDetail>(`/catalog/releases/${id}`)
      setRelease(updated)
    } catch (e: any) {
      toast.error(e.message ?? "Action failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <AdminTopbar title="Release" />
        <div className="p-6 flex items-center justify-center min-h-64 text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!release) {
    return (
      <div>
        <AdminTopbar title="Release not found" />
        <div className="p-6 text-muted-foreground">Release not found.</div>
        <Button variant="ghost" asChild>
          <Link href="/catalog">Back to Catalog</Link>
        </Button>
      </div>
    )
  }

  const tracks = release.tracks ?? []
  const distributionTargets: string[] = []
  if (release.distribution_wave) distributionTargets.push("Wave")
  if (release.distribution_external) distributionTargets.push("External")

  const metadataChecklist = [
    { id: "m1", label: "Title set", checked: !!release.title },
    { id: "m2", label: "Primary artist set", checked: !!release.primary_artist },
    { id: "m3", label: "Release date set", checked: !!release.release_date },
    { id: "m4", label: "Cover art uploaded", checked: !!release.cover_art_url },
    { id: "m5", label: "All tracks have ISRC", checked: tracks.length > 0 && tracks.every((t) => !!t.isrc) },
    { id: "m6", label: "P/C lines present", checked: tracks.every((t) => !!t.p_line && !!t.c_line) },
    { id: "m7", label: "Rights confirmed", checked: release.confirm_rights },
    { id: "m8", label: "Credits confirmed", checked: release.confirm_credits },
  ]
  const audioChecklist = [
    { id: "a1", label: "All tracks have audio", checked: tracks.every((t) => !!t.file_url || t.upload_status === "complete") },
    { id: "a2", label: "Explicit flagged", checked: true },
    { id: "a3", label: "Duration present", checked: tracks.every((t) => !!t.duration_text) },
  ]
  const riskFlags = [
    { id: "r1", label: "Sample clearance missing", severity: "high", detected: release.rights_type === "licensed" && !release.license_evidence_url },
    { id: "r2", label: "Rights conflict", severity: "high", detected: false },
  ]

  const metaChecked = metadataChecklist.filter((c) => c.checked).length
  const metaTotal = metadataChecklist.length
  const audioChecked = audioChecklist.filter((c) => c.checked).length
  const audioTotal = audioChecklist.length

  return (
    <div>
      <AdminTopbar title="Release verification" />
      <div className="p-6 max-w-[1200px] space-y-6">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
          <Link href="/catalog">
            <ArrowLeft className="size-4" /> Back to Catalog
          </Link>
        </Button>

        {release.has_active_dispute && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3" role="alert">
            <Ban className="size-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Active dispute</p>
              <p className="text-xs text-destructive/80">Release cannot be approved while a dispute is active.</p>
            </div>
          </div>
        )}

        {/* Release summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Disc3 className="size-5 text-primary" />
                Release summary
              </CardTitle>
              <Badge className={statusColors[release.status] ?? "bg-muted"}>
                {formatStatus(release.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-5">
              <div className="shrink-0">
                {release.cover_art_url ? (
                  <img
                    src={release.cover_art_url}
                    alt="Cover"
                    className="size-28 rounded-md object-cover border border-border"
                  />
                ) : (
                  <div className="size-28 rounded-md border border-border bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <ImageIcon className="size-7" />
                    <span className="text-[10px]">No cover</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 flex-1 content-start text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="font-medium text-foreground">{release.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Artist</p>
                  <p className="font-medium text-foreground">{release.primary_artist}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium text-foreground uppercase">{release.type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Label</p>
                  <p className="font-medium text-foreground">{release.label ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Genre</p>
                  <p className="font-medium text-foreground">{release.primary_genre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Language</p>
                  <p className="font-medium text-foreground">{release.primary_language ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tracks</p>
                  <p className="font-medium text-foreground">{tracks.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Release date</p>
                  <p className="font-medium text-foreground">{release.release_date ?? "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Distribution</p>
                  <p className="font-medium text-foreground">{distributionTargets.join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rights</p>
                  <p className="font-medium text-foreground capitalize">{release.rights_type ?? "—"}</p>
                </div>
                {release.reviewer_comment && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-xs text-muted-foreground">Reviewer comment</p>
                    <p className="font-medium text-foreground text-sm">{release.reviewer_comment}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tracks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="size-4 text-primary" />
              Tracks ({tracks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tracks.length === 0 ? (
              <div className="px-6 pb-5 text-sm text-muted-foreground">No tracks linked.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Title / Artist</TableHead>
                    <TableHead className="w-24">Audio</TableHead>
                    <TableHead className="w-28">ISRC</TableHead>
                    <TableHead className="w-24">Explicit</TableHead>
                    <TableHead className="w-28">P-Line</TableHead>
                    <TableHead className="w-28">C-Line</TableHead>
                    <TableHead className="w-16 text-center">Lyrics</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tracks.map((track, i) => (
                    <TableRow key={track.id}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{track.title || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground">{track.primary_artist ?? release.primary_artist}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={track.file_url ? "secondary" : "destructive"} className="text-[10px] capitalize">
                          {track.upload_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{track.isrc ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={track.explicit === "explicit" ? "text-warning border-warning/40 text-[10px]" : "text-[10px]"}>
                          {explicitLabel[track.explicit] ?? track.explicit}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[6rem]">{track.p_line ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[6rem]">{track.c_line ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        {track.lyrics?.trim() ? (
                          <CheckCircle2 className="size-3.5 text-success mx-auto" />
                        ) : (
                          <XCircle className="size-3.5 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Metadata review */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Metadata review
                </CardTitle>
                <span className="text-xs text-muted-foreground">{metaChecked}/{metaTotal}</span>
              </div>
              <Progress value={metaTotal > 0 ? (metaChecked / metaTotal) * 100 : 0} className="h-1.5 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              {metadataChecklist.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <Checkbox id={item.id} checked={item.checked} disabled aria-label={item.label} />
                  <Label htmlFor={item.id} className="text-sm cursor-default">{item.label}</Label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Audio review */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Music className="size-4 text-primary" />
                  Audio review
                </CardTitle>
                <span className="text-xs text-muted-foreground">{audioChecked}/{audioTotal}</span>
              </div>
              <Progress value={audioTotal > 0 ? (audioChecked / audioTotal) * 100 : 0} className="h-1.5 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              {audioChecklist.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <Checkbox id={item.id} checked={item.checked} disabled aria-label={item.label} />
                  <Label htmlFor={item.id} className="text-sm cursor-default">{item.label}</Label>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Risk flags */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="size-4 text-warning" />
              Risk flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskFlags.map((flag) => (
              <div key={flag.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {flag.detected ? (
                    <AlertTriangle className="size-3.5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="size-3.5 text-success" />
                  )}
                  <span className={flag.detected ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                    {flag.label}
                  </span>
                </div>
                <Badge variant="outline" className={flag.detected ? "bg-destructive/15 text-destructive border-destructive/30 text-[10px]" : "bg-success/15 text-success border-success/30 text-[10px]"}>
                  {flag.detected ? "Detected" : "Clear"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {!release.has_active_dispute && !["published", "rejected", "takedown"].includes(release.status) && (
                <Button size="sm" onClick={() => setActionType("approve")}>
                  <CheckCircle2 className="size-4 mr-1.5" />
                  Approve
                </Button>
              )}
              {!["published", "rejected", "takedown"].includes(release.status) && (
                <Button size="sm" variant="outline" onClick={() => setActionType("request_changes")}>
                  <AlertTriangle className="size-4 mr-1.5" />
                  Request changes
                </Button>
              )}
              {!["published", "rejected", "takedown"].includes(release.status) && (
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setActionType("reject")}>
                  <XCircle className="size-4 mr-1.5" />
                  Reject
                </Button>
              )}
              {release.status !== "published" && (
                <Button size="sm" variant="destructive" onClick={() => setActionType("force_publish")}>
                  <Zap className="size-4 mr-1.5" />
                  Force publish
                </Button>
              )}
              {!["takedown"].includes(release.status) && (
                <Button size="sm" variant="destructive" onClick={() => setActionType("takedown")}>
                  <Ban className="size-4 mr-1.5" />
                  Takedown
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action confirmation modal */}
        <Dialog open={actionType !== null} onOpenChange={() => { setActionType(null); setComment("") }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "force_publish" && "Force publish"}
                {actionType === "takedown" && "Takedown"}
                {actionType === "approve" && "Approve"}
                {actionType === "request_changes" && "Request changes"}
                {actionType === "reject" && "Reject"}
              </DialogTitle>
              <DialogDescription>
                This action will be logged. A comment is required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="comment">Comment (required)</Label>
              <Textarea
                id="comment"
                placeholder="Provide a reason…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-20"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setActionType(null); setComment("") }} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={runAction}
                variant={actionType === "reject" || actionType === "force_publish" || actionType === "takedown" ? "destructive" : "default"}
                disabled={submitting || !comment.trim()}
              >
                {submitting ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
