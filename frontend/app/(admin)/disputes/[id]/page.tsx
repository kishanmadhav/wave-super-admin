"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import { getAudioStreamUrl } from "@/lib/storage"
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Clock,
  User,
  ExternalLink,
  Scale,
  RefreshCw,
  Music,
  Play,
  Pause,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

interface Evidence {
  id: string
  name: string
  file_url: string | null
  type: string
  uploader_name: string | null
  note: string | null
  uploaded_at: string
}

interface TimelineEntry {
  id: string
  action: string
  actor: string
  detail: string | null
  created_at: string
}

interface DisputeMessage {
  id: string
  sender_name: string
  message: string
  created_at: string
}

interface InternalNote {
  id: string
  note: string
  added_by: string | null
  created_at: string
}

interface Party {
  id: string
  email: string
  display_name: string
}

interface ContestedTrack {
  id: string
  title: string
  file_url: string | null
  file_name: string | null
  duration_text: string | null
  position: number
}

interface DisputeDetail {
  id: string
  type: string
  target_type: string
  target_id: string
  target_name: string | null
  claim_detail: string | null
  summary: string | null
  claimant_name: string | null
  severity: string
  status: string
  distribution_paused?: boolean
  ownership_paused?: boolean
  revenue_held?: boolean
  visibility_limited?: boolean
  created_at: string
  updated_at: string
  dispute_evidence: Evidence[]
  dispute_timeline: TimelineEntry[]
  dispute_messages: DisputeMessage[]
  dispute_internal_notes: InternalNote[]
  claimant: Party | null
  content_owner: Party | null
  contested_tracks?: ContestedTrack[]
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00"
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
}

function fileFormat(fileName: string | null, fileUrl: string | null): string {
  const name = fileName ?? fileUrl ?? ""
  const ext = name.split("?")[0].split(".").pop()?.toUpperCase()
  return ext && ext.length <= 5 ? ext : "—"
}

const urlCache = new Map<string, { url: string; exp: number }>()
async function getStreamUrl(fileUrl: string): Promise<string> {
  const cached = urlCache.get(fileUrl)
  if (cached && cached.exp > Date.now()) return cached.url
  const url = await getAudioStreamUrl(fileUrl, 3600)
  urlCache.set(fileUrl, { url, exp: Date.now() + 55 * 60 * 1000 })
  return url
}

function TrackPlayer({ fileUrl, fileName, duration, label }: { fileUrl: string; fileName: string | null; duration: string | null; label?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null }, [])

  const toggle = useCallback(async () => {
    setErr(null)
    try {
      if (!audioRef.current) {
        setLoading(true)
        let src: string
        try {
          src = await getStreamUrl(fileUrl)
        } catch (e: unknown) {
          setErr(e instanceof Error ? e.message : "Cannot load audio")
          setLoading(false)
          return
        }
        const audio = new Audio(src)
        audio.preload = "auto"
        audio.onloadedmetadata = () => { setTotal(audio.duration); setLoading(false) }
        audio.ontimeupdate = () => { if (!dragging) setCurrent(audio.currentTime) }
        audio.onended = () => { setPlaying(false); setCurrent(0) }
        audio.onerror = () => { setErr("Playback failed"); setPlaying(false); setLoading(false) }
        audioRef.current = audio
        await audio.play()
        setPlaying(true)
        return
      }
      if (playing) { audioRef.current.pause(); setPlaying(false) }
      else { await audioRef.current.play(); setPlaying(true) }
    } catch {
      setErr("Playback failed")
      setLoading(false)
    }
  }, [fileUrl, playing, dragging])

  const seek = useCallback((value: number) => {
    setCurrent(value)
    if (audioRef.current) audioRef.current.currentTime = value
  }, [])

  const displayTotal = total > 0 ? formatTime(total) : duration ?? "—"
  const progress = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="flex flex-col gap-1 min-w-0 w-full max-w-md">
      {label && <p className="text-sm font-medium text-foreground truncate">{label}</p>}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
            {formatTime(current)}<span className="text-muted-foreground/50"> / </span>{displayTotal}
          </span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 shrink-0">
            {fileFormat(fileName, fileUrl)}
          </Badge>
        </div>
      </div>
      <div className={total === 0 ? "relative w-full h-2 flex items-center opacity-40" : "relative w-full h-2 flex items-center"}>
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-muted" />
        <div className="absolute left-0 h-[3px] rounded-full bg-primary pointer-events-none" style={{ width: `${progress}%` }} />
        <input
          type="range"
          min={0}
          max={total > 0 ? total : 100}
          step={0.1}
          value={current}
          onMouseDown={() => setDragging(true)}
          onTouchStart={() => setDragging(true)}
          onChange={(e) => setCurrent(Number(e.target.value))}
          onMouseUp={(e) => { setDragging(false); seek(Number((e.target as HTMLInputElement).value)) }}
          onTouchEnd={(e) => { setDragging(false); seek(Number((e.target as HTMLInputElement).value)) }}
          disabled={total === 0}
          aria-label="Seek"
          className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
      {err && <span className="text-[10px] text-destructive">{err}</span>}
    </div>
  )
}

const SEVERITY_BADGE: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-primary/15 text-primary border-primary/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-primary/15 text-primary",
  awaiting_uploader_response: "bg-warning/15 text-warning",
  awaiting_claimant_response: "bg-warning/15 text-warning",
  under_review: "bg-primary/15 text-primary",
  escalated: "bg-destructive/15 text-destructive",
  resolved: "bg-success/15 text-success",
  closed: "bg-secondary text-secondary-foreground",
}

export default function DisputeReviewPage() {
  const { id } = useParams<{ id: string }>()
  const [dispute, setDispute] = useState<DisputeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [rulingOption, setRulingOption] = useState<
    "transfer_to_claimant" |
    "transfer_to_content_owner" |
    "take_down" |
    "take_down_cover_art" |
    "close" |
    ""
  >("")
  const [rulingText, setRulingText] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [saving, setSaving] = useState(false)

  const refetch = useCallback(() => {
    if (!id) return
    api.get<DisputeDetail>(`/disputes/${id}`).then(setDispute).catch(() => setDispute(null))
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .get<DisputeDetail>(`/disputes/${id}`)
      .then(setDispute)
      .catch(() => {
        toast.error("Failed to load dispute")
        setDispute(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function submitRuling() {
    if (!id || !rulingOption) {
      toast.error("Select a ruling option")
      return
    }
    const status = rulingOption === "close" ? "closed" : "resolved"
    setSaving(true)
    try {
      await api.patch(`/disputes/${id}/status`, {
        status,
        ruling: rulingOption,
        resolution: rulingText.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
      })
      toast.success("Ruling recorded")
      setRulingOption("")
      setRulingText("")
      setInternalNote("")
      refetch()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save ruling")
    }
    setSaving(false)
  }

  async function addNoteOnly() {
    if (!id || !internalNote.trim()) {
      toast.error("Enter an internal note")
      return
    }
    setSaving(true)
    try {
      await api.post(`/disputes/${id}/notes`, { note: internalNote.trim() })
      toast.success("Note added")
      setInternalNote("")
      refetch()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add note")
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div>
        <AdminTopbar title="Dispute review" />
        <div className="p-6 flex items-center justify-center min-h-64 text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!dispute) {
    return (
      <div>
        <AdminTopbar title="Dispute not found" />
        <div className="p-6 text-muted-foreground">Dispute not found.</div>
        <Button variant="ghost" asChild>
          <Link href="/disputes">Back to Disputes</Link>
        </Button>
      </div>
    )
  }

  const evidence = dispute.dispute_evidence ?? []
  const timeline = dispute.dispute_timeline ?? []
  const messages = dispute.dispute_messages ?? []
  const notes = dispute.dispute_internal_notes ?? []
  const contestedTracks = dispute.contested_tracks ?? []
  const isOwnershipDispute = ["ownership_claim", "unauthorized_upload", "publishing_claim"].includes(dispute.type)
  const isArtworkDispute = dispute.type === "artwork_violation"
  const canTakeDownCoverArt = isArtworkDispute && dispute.target_type === "release"

  return (
    <div>
      <AdminTopbar title="Dispute review" />
      <div className="p-6 max-w-[1000px] space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
            <Link href="/disputes">
              <ArrowLeft className="size-4" /> Back to Disputes
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={refetch} aria-label="Refresh">
            <RefreshCw className="size-3.5" />
          </Button>
        </div>

        {/* Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-foreground capitalize">{dispute.type.replace(/_/g, " ")}</h2>
              <Badge className={SEVERITY_BADGE[dispute.severity] ?? ""}>{dispute.severity}</Badge>
              <Badge variant="outline" className={STATUS_BADGE[dispute.status] ?? ""}>
                {dispute.status.replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <Clock className="size-3" /> {formatDateTime(dispute.created_at)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Item in dispute */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="size-4 text-primary" /> Item in dispute
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="font-medium text-foreground capitalize">{dispute.target_name ?? dispute.target_id ?? "—"}</p>
                <p className="text-xs text-muted-foreground capitalize">{dispute.target_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Target ID</p>
                <p className="font-mono text-xs text-muted-foreground break-all">{dispute.target_id}</p>
              </div>
            </div>
            {dispute.summary && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Summary</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.summary}</p>
              </div>
            )}
            {dispute.claim_detail && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Claim detail</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.claim_detail}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Listen to contested record */}
        {contestedTracks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Music className="size-4 text-primary" /> Listen to contested record
              </CardTitle>
              <p className="text-sm text-muted-foreground">Play the disputed release or track.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {contestedTracks.map((track) => (
                <div key={track.id} className="rounded-lg border border-border p-4 bg-muted/20 space-y-2">
                  <p className="text-sm font-medium text-foreground">{track.title}</p>
                  {track.file_url ? (
                    <TrackPlayer
                      fileUrl={track.file_url}
                      fileName={track.file_name}
                      duration={track.duration_text}
                      label={undefined}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No audio file linked</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Enforcement impact */}
        {(dispute.distribution_paused || dispute.ownership_paused || dispute.revenue_held || dispute.visibility_limited) && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-warning">Enforcement impact</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {dispute.distribution_paused && <p>Distribution paused</p>}
              {dispute.ownership_paused && <p>Ownership drops paused</p>}
              {dispute.revenue_held && <p>Revenue held</p>}
              {dispute.visibility_limited && <p>Visibility limited</p>}
            </CardContent>
          </Card>
        )}

        {/* Parties involved */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4 text-primary" /> Parties involved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Claimant</p>
                <p className="font-medium text-foreground">{dispute.claimant?.display_name ?? dispute.claimant_name ?? "—"}</p>
                {dispute.claimant?.email && <p className="text-xs text-muted-foreground">{dispute.claimant.email}</p>}
              </div>
              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Content owner</p>
                <p className="font-medium text-foreground">{dispute.content_owner?.display_name ?? "—"}</p>
                {dispute.content_owner?.email && <p className="text-xs text-muted-foreground">{dispute.content_owner.email}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evidence — view documents */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4 text-primary" /> Submitted evidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evidence uploaded.</p>
            ) : (
              <ul className="space-y-3">
                {evidence.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-3 rounded-lg border border-border p-3 bg-muted/10">
                    <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {ev.file_url ? (
                          <a
                            href={ev.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {ev.name}
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-foreground">{ev.name}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {ev.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ev.uploader_name ?? "Unknown"} · {formatDateTime(ev.uploaded_at)}
                      </p>
                      {ev.note && (
                        <p className="text-xs text-foreground/90 mt-2 whitespace-pre-wrap border-l-2 border-border pl-2">{ev.note}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((entry, i) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="size-2 rounded-full bg-primary mt-1.5" />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-2" />}
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-medium text-foreground">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">{entry.actor} · {formatDateTime(entry.created_at)}</p>
                      {entry.detail && <p className="text-xs text-foreground/80 mt-1">{entry.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discussion messages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" /> Discussion
            </CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages.</p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li key={m.id} className="text-sm border-l-2 border-border pl-3 py-1">
                    <span className="font-medium text-foreground">{m.sender_name}</span>
                    <span className="text-muted-foreground text-xs ml-2">{formatDateTime(m.created_at)}</span>
                    <p className="text-foreground/90 mt-0.5 whitespace-pre-wrap">{m.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Internal notes (admin only) */}
        <Card className="border-dashed border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Internal notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No internal notes.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
                    <p className="text-foreground/90 whitespace-pre-wrap">{n.note}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Ruling / Admin actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="size-4 text-primary" /> Make a ruling
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose a ruling. For ownership disputes, “rule in favour” will transfer ownership in the database (reflected in CMS too).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs mb-2 block">Ruling</Label>
              <div className="flex flex-wrap gap-2">
                {isOwnershipDispute && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={rulingOption === "transfer_to_claimant" ? "default" : "outline"}
                      onClick={() => setRulingOption("transfer_to_claimant")}
                    >
                      Rule in favour of claimant (transfer ownership)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rulingOption === "transfer_to_content_owner" ? "default" : "outline"}
                      onClick={() => setRulingOption("transfer_to_content_owner")}
                    >
                      Rule in favour of content owner (transfer ownership)
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={rulingOption === "take_down" ? "destructive" : "outline"}
                  className={rulingOption === "take_down" ? "" : "text-destructive border-destructive/40 hover:bg-destructive/10"}
                  onClick={() => setRulingOption("take_down")}
                >
                  Take down song permanently
                </Button>
                {canTakeDownCoverArt && (
                  <Button
                    type="button"
                    size="sm"
                    variant={rulingOption === "take_down_cover_art" ? "destructive" : "outline"}
                    className={rulingOption === "take_down_cover_art" ? "" : "text-destructive border-destructive/40 hover:bg-destructive/10"}
                    onClick={() => setRulingOption("take_down_cover_art")}
                  >
                    Take down cover art
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={rulingOption === "close" ? "secondary" : "outline"}
                  onClick={() => setRulingOption("close")}
                >
                  Close (dismiss)
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Ruling / resolution (recorded on timeline)</Label>
              <Textarea
                value={rulingText}
                onChange={(e) => setRulingText(e.target.value)}
                placeholder="Optional: add explanation for the ruling"
                className="mt-1 min-h-20 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Internal note (not visible to parties)</Label>
              <Textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Private note for admin use only"
                className="mt-1 min-h-16 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={submitRuling} disabled={saving || !rulingOption}>
                {saving ? "Saving…" : "Submit ruling"}
              </Button>
              <Button size="sm" variant="outline" onClick={addNoteOnly} disabled={saving || !internalNote.trim()}>
                Add note only
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
