"use client"

import { useEffect, useState, useRef, useCallback } from "react"
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
  Play,
  Pause,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  Pencil,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { getAudioStreamUrl } from "@/lib/storage"

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
  subtitle?: string | null
  artists?: string | null
  featured_artists?: string[] | null
  producers?: string[] | null
  composers?: string[] | null
  lyricists?: string[] | null
  publishers?: string[] | null
  lyrics_translation?: string | null
  primary_genre?: string | null
  sub_genre?: string | null
  year_of_recording?: string | null
  year_of_release?: string | null
  mood_tags?: string[] | null
  tempo?: string | null
  musical_key?: string | null
  theme_tags?: string[] | null
  cultural_tag?: string | null
  track_rights_type?: string | null
  original_artist?: string | null
  sample_owner?: string | null
  contributors?: Contributor[]
  [key: string]: unknown
}

interface SplitRecipient {
  id: string
  release_id: string
  name: string
  identifier: string | null
  role: string
  share_percent: number
  created_at: string
}

interface Contributor {
  id: string
  track_id: string
  name: string
  role: string
  publisher: string | null
  share_percent: number
  created_at: string
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
  split_recipients?: SplitRecipient[]
  description?: string | null
  territory?: string | null
  upc?: string | null
  catalog_number?: string | null
  license_type?: string | null
  license_owner?: string | null
  license_territory?: string | null
  license_start?: string | null
  license_end?: string | null
  confirm_splits?: boolean
  confirm_terms?: boolean
  explicit_content?: string | null
  [key: string]: unknown
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/15 text-primary",
  under_review: "bg-primary/15 text-primary",
  approved: "bg-success/15 text-success",
  scheduled: "bg-blue-500/15 text-blue-500",
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

type ActionType = "approve" | "request_changes" | "reject" | "force_publish" | "takedown" | "permanent_delete"

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00"
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
}

/** Keys to exclude from additional info: URLs and nested/relation data we show separately */
function isUrlOrExcludedKey(key: string, context: "release" | "track"): boolean {
  const lower = key.toLowerCase()
  if (lower.includes("url") || lower.endsWith("_url")) return true
  if (context === "release" && (key === "tracks" || key === "split_recipients")) return true
  if (context === "track" && key === "contributors") return true
  return false
}

function formatAdditionalValue(value: unknown): string {
  if (value == null) return "—"
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function fileFormat(fileName: string | null, fileUrl: string | null): string {
  const name = fileName ?? fileUrl ?? ""
  const ext = name.split("?")[0].split(".").pop()?.toUpperCase()
  return ext && ext.length <= 5 ? ext : "—"
}

function ReleaseEditForm({
  release,
  onSave,
  onCancel,
  saving,
}: {
  release: ReleaseDetail
  onSave: (patch: Record<string, unknown>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle] = useState(release.title)
  const [primary_artist, setPrimaryArtist] = useState(release.primary_artist)
  const [label, setLabel] = useState(release.label ?? "")
  const [primary_genre, setPrimaryGenre] = useState(release.primary_genre ?? "")
  const [primary_language, setPrimaryLanguage] = useState(release.primary_language ?? "")
  const [release_date, setReleaseDate] = useState(release.release_date ?? "")
  const [description, setDescription] = useState((release as Record<string, unknown>).description ?? "")
  const [reviewer_comment, setReviewerComment] = useState(release.reviewer_comment ?? "")
  const [territory, setTerritory] = useState((release as Record<string, unknown>).territory ?? "")
  const [upc, setUpc] = useState((release as Record<string, unknown>).upc ?? "")
  const [rights_type, setRightsType] = useState(release.rights_type ?? "")
  const [license_type, setLicenseType] = useState((release as Record<string, unknown>).license_type ?? "")
  const [license_owner, setLicenseOwner] = useState((release as Record<string, unknown>).license_owner ?? "")
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      title,
      primary_artist,
      label: label || undefined,
      primary_genre: primary_genre || undefined,
      primary_language: primary_language || undefined,
      release_date: release_date || undefined,
      description: description || undefined,
      reviewer_comment: reviewer_comment || undefined,
      territory: territory || undefined,
      upc: upc || undefined,
      rights_type: rights_type || undefined,
      license_type: license_type || undefined,
      license_owner: license_owner || undefined,
    })
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-3">
        <div><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Primary artist</Label><Input value={primary_artist} onChange={(e) => setPrimaryArtist(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Genre</Label><Input value={primary_genre} onChange={(e) => setPrimaryGenre(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Language</Label><Input value={primary_language} onChange={(e) => setPrimaryLanguage(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Release date</Label><Input type="date" value={release_date} onChange={(e) => setReleaseDate(e.target.value)} className="h-8 mt-0.5" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16 mt-0.5" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Reviewer comment</Label><Textarea value={reviewer_comment} onChange={(e) => setReviewerComment(e.target.value)} className="min-h-16 mt-0.5" /></div>
        <div><Label className="text-xs">Territory</Label><Input value={territory} onChange={(e) => setTerritory(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">UPC</Label><Input value={upc} onChange={(e) => setUpc(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Rights type</Label><Input value={rights_type} onChange={(e) => setRightsType(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">License type</Label><Input value={license_type} onChange={(e) => setLicenseType(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">License owner</Label><Input value={license_owner} onChange={(e) => setLicenseOwner(e.target.value)} className="h-8 mt-0.5" /></div>
      </div>
    </form>
  )
}

function TrackEditForm({
  track,
  onSave,
  onCancel,
  saving,
}: {
  track: TrackRow
  onSave: (patch: Record<string, unknown>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle] = useState(track.title)
  const [primary_artist, setPrimaryArtist] = useState(track.primary_artist ?? "")
  const [isrc, setIsrc] = useState(track.isrc ?? "")
  const [p_line, setPLine] = useState(track.p_line ?? "")
  const [c_line, setCLine] = useState(track.c_line ?? "")
  const [lyrics, setLyrics] = useState(track.lyrics ?? "")
  const [lyrics_translation, setLyricsTranslation] = useState(track.lyrics_translation ?? "")
  const [subtitle, setSubtitle] = useState(track.subtitle ?? "")
  const [primary_genre, setPrimaryGenre] = useState(track.primary_genre ?? "")
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      title,
      primary_artist: primary_artist || undefined,
      isrc: isrc || undefined,
      p_line: p_line || undefined,
      c_line: c_line || undefined,
      lyrics: lyrics || undefined,
      lyrics_translation: lyrics_translation || undefined,
      subtitle: subtitle || undefined,
      primary_genre: primary_genre || undefined,
    })
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-3">
        <div><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Primary artist</Label><Input value={primary_artist} onChange={(e) => setPrimaryArtist(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Subtitle</Label><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">ISRC</Label><Input value={isrc} onChange={(e) => setIsrc(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">P-Line</Label><Input value={p_line} onChange={(e) => setPLine(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">C-Line</Label><Input value={c_line} onChange={(e) => setCLine(e.target.value)} className="h-8 mt-0.5" /></div>
        <div><Label className="text-xs">Genre</Label><Input value={primary_genre} onChange={(e) => setPrimaryGenre(e.target.value)} className="h-8 mt-0.5" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Lyrics</Label><Textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} className="min-h-32 font-sans text-sm whitespace-pre-wrap mt-0.5" placeholder="Lyrics (plain text)" /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Lyrics translation</Label><Textarea value={lyrics_translation} onChange={(e) => setLyricsTranslation(e.target.value)} className="min-h-24 font-sans text-sm whitespace-pre-wrap mt-0.5" placeholder="Translation" /></div>
      </div>
    </form>
  )
}

const urlCache = new Map<string, { url: string; exp: number }>()
async function getUrl(fileUrl: string): Promise<string> {
  const cached = urlCache.get(fileUrl)
  if (cached && cached.exp > Date.now()) return cached.url
  const url = await getAudioStreamUrl(fileUrl, 3600)
  urlCache.set(fileUrl, { url, exp: Date.now() + 55 * 60 * 1000 })
  return url
}

function TrackPlayer({ fileUrl, fileName, duration }: { fileUrl: string; fileName: string | null; duration: string | null }) {
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
          src = await getUrl(fileUrl)
        } catch (e: any) {
          setErr(e?.message ?? "Cannot load audio")
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
    <div className="flex flex-col gap-1 min-w-0 w-44">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="size-7 shrink-0"
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : playing ? <Pause className="size-3" /> : <Play className="size-3" />}
        </Button>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
            {formatTime(current)}<span className="text-muted-foreground/50"> / </span>{displayTotal}
          </span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
            {fileFormat(fileName, fileUrl)}
          </Badge>
        </div>
      </div>
      <div className={total === 0 ? "relative w-full h-4 flex items-center opacity-40" : "relative w-full h-4 flex items-center"}>
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-muted" />
        <div className="absolute left-0 h-[3px] rounded-full bg-primary pointer-events-none" style={{ width: `${progress}%` }} />
        <div className="absolute w-3 h-3 rounded-full bg-primary pointer-events-none shadow-sm -translate-x-1/2" style={{ left: `${progress}%` }} />
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
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
      {err && <span className="text-[10px] text-destructive">{err}</span>}
    </div>
  )
}

export default function CatalogReleaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [release, setRelease] = useState<ReleaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionType, setActionType] = useState<ActionType | null>(null)
  const [comment, setComment] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false)
  const [editingRelease, setEditingRelease] = useState(false)
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const refetch = useCallback(() => {
    if (!id) return
    api.get<ReleaseDetail>(`/catalog/releases/${id}`).then(setRelease).catch(() => setRelease(null))
  }, [id])

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
    if (actionType === "permanent_delete" && confirmText.trim().toUpperCase() !== "DELETE") {
      toast.error("Type DELETE to confirm permanent deletion")
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
      } else if (actionType === "permanent_delete") {
        await api.post(`/catalog/releases/${id}/permanent-delete`, { comment: comment.trim() })
        toast.success("Release permanently deleted")
        router.push("/catalog")
        return
      } else {
        const statusMap = {
          approve: "approved",
          request_changes: "changes_requested",
          reject: "rejected",
        } as const
        const status = actionType ? statusMap[actionType] : null
        if (status) {
          const result = await api.patch<ReleaseDetail>(`/catalog/releases/${id}/status`, { status, comment: comment.trim() })
          const resultStatus = (result as any)?.status
          if (status === "approved" && resultStatus === "scheduled") {
            toast.success(`Release approved and scheduled for publication on ${release?.release_date ?? "the artist's release date"}`)
          } else {
            toast.success(`Release ${formatStatus(resultStatus ?? status)}`)
          }
        }
      }
      setActionType(null)
      setComment("")
      setConfirmText("")
      const updated = await api.get<ReleaseDetail>(`/catalog/releases/${id}`)
      setRelease(updated)
    } catch (e: any) {
      toast.error(e.message ?? "Action failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function saveReleaseEdit(patch: Record<string, unknown>) {
    if (!id) return
    setSavingEdit(true)
    try {
      await api.patch(`/catalog/releases/${id}`, patch)
      toast.success("Release updated")
      setEditingRelease(false)
      refetch()
    } catch (e: any) {
      toast.error(e.message ?? "Update failed")
    } finally {
      setSavingEdit(false)
    }
  }

  async function saveTrackEdit(trackId: string, patch: Record<string, unknown>) {
    if (!id) return
    setSavingEdit(true)
    try {
      await api.patch(`/catalog/releases/${id}/tracks/${trackId}`, patch)
      toast.success("Track updated")
      setEditingTrackId(null)
      refetch()
    } catch (e: any) {
      toast.error(e.message ?? "Update failed")
    } finally {
      setSavingEdit(false)
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
                        {track.file_url ? (
                          <TrackPlayer fileUrl={track.file_url} fileName={track.file_name} duration={track.duration_text} />
                        ) : (
                          <span className="text-xs text-muted-foreground">No file linked</span>
                        )}
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

        {/* Lyrics — clear display when present */}
        {tracks.some((t) => t.lyrics?.trim()) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Lyrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {tracks.map((track) =>
                track.lyrics?.trim() ? (
                  <div key={track.id} className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{track.title}</p>
                    <pre className="whitespace-pre-wrap text-sm text-foreground bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto border border-border font-sans leading-relaxed">
                      {track.lyrics}
                    </pre>
                    {track.lyrics_translation?.trim() && (
                      <>
                        <p className="text-xs text-muted-foreground mt-2">Translation</p>
                        <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 max-h-60 overflow-y-auto border border-border font-sans leading-relaxed">
                          {track.lyrics_translation}
                        </pre>
                      </>
                    )}
                  </div>
                ) : null
              )}
            </CardContent>
          </Card>
        )}

        {/* Show additional information — all release/track data + edit */}
        <Collapsible open={showAdditionalInfo} onOpenChange={setShowAdditionalInfo}>
          <Card>
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full text-left">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="size-4 text-primary" />
                      Show additional information
                    </CardTitle>
                    {showAdditionalInfo ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All data provided by the artist in the release wizard (metadata, credits, rights, lyrics). You can edit and save.
                  </p>
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-6 border-t border-border">
                {/* Release: all fields + Edit */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Release — all fields</h4>
                    {!editingRelease ? (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditingRelease(true)}>
                        <Pencil className="size-3.5" /> Edit release
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingRelease(false)}>Cancel</Button>
                        <ReleaseEditForm release={release} onSave={saveReleaseEdit} onCancel={() => setEditingRelease(false)} saving={savingEdit} />
                      </div>
                    )}
                  </div>
                  {!editingRelease && (
                    <>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {Object.entries(release)
                          .filter(([k]) => !["tracks", "id", "profile_id", "artist_id"].includes(k) && !isUrlOrExcludedKey(k, "release"))
                          .map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <dt className="text-muted-foreground capitalize min-w-[140px]">{key.replace(/_/g, " ")}</dt>
                              <dd className="break-words">{formatAdditionalValue(value)}</dd>
                            </div>
                          ))}
                      </dl>
                      {/* Revenue splits from DB (split_recipients by release_id) */}
                      {release.split_recipients && release.split_recipients.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <h5 className="text-sm font-semibold text-foreground mb-2">Revenue splits</h5>
                          <div className="rounded border border-border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                  <th className="text-left p-2 font-medium">Name</th>
                                  <th className="text-left p-2 font-medium">Role</th>
                                  <th className="text-left p-2 font-medium">Identifier</th>
                                  <th className="text-right p-2 font-medium">Share %</th>
                                </tr>
                              </thead>
                              <tbody>
                                {release.split_recipients.map((s: SplitRecipient) => (
                                  <tr key={s.id} className="border-b border-border last:border-0">
                                    <td className="p-2">{s.name}</td>
                                    <td className="p-2 capitalize">{s.role}</td>
                                    <td className="p-2 text-muted-foreground">{s.identifier ?? "—"}</td>
                                    <td className="p-2 text-right">{s.share_percent}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Tracks: all fields from DB + contributor splits + Edit per track */}
                {tracks.map((track) => (
                  <div key={track.id} className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Track: {track.title}</h4>
                      {editingTrackId !== track.id ? (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditingTrackId(track.id)}>
                          <Pencil className="size-3.5" /> Edit track
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingTrackId(null)}>Cancel</Button>
                          <TrackEditForm track={track} onSave={(patch) => saveTrackEdit(track.id, patch)} onCancel={() => setEditingTrackId(null)} saving={savingEdit} />
                        </div>
                      )}
                    </div>
                    {editingTrackId !== track.id && (
                      <>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {Object.entries(track)
                            .filter(([k]) => k !== "id" && k !== "release_id" && !isUrlOrExcludedKey(k, "track"))
                            .map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <dt className="text-muted-foreground capitalize min-w-[140px]">{key.replace(/_/g, " ")}</dt>
                                <dd className="break-words">{formatAdditionalValue(value)}</dd>
                              </div>
                            ))}
                        </dl>
                        {/* Contributor splits from DB (contributors by track_id) */}
                        {track.contributors && track.contributors.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h5 className="text-sm font-semibold text-foreground mb-2">Contributor splits</h5>
                            <div className="rounded border border-border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/50 border-b border-border">
                                    <th className="text-left p-2 font-medium">Name</th>
                                    <th className="text-left p-2 font-medium">Role</th>
                                    <th className="text-left p-2 font-medium">Publisher</th>
                                    <th className="text-right p-2 font-medium">Share %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {track.contributors.map((c: Contributor) => (
                                    <tr key={c.id} className="border-b border-border last:border-0">
                                      <td className="p-2">{c.name}</td>
                                      <td className="p-2 capitalize">{c.role}</td>
                                      <td className="p-2 text-muted-foreground">{c.publisher ?? "—"}</td>
                                      <td className="p-2 text-right">{c.share_percent}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

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
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setActionType("permanent_delete")}
              >
                <XCircle className="size-4 mr-1.5" />
                Delete permanently
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action confirmation modal */}
        <Dialog open={actionType !== null} onOpenChange={() => { setActionType(null); setComment(""); setConfirmText("") }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "force_publish" && "Force publish"}
                {actionType === "takedown" && "Takedown"}
                {actionType === "permanent_delete" && "Delete permanently"}
                {actionType === "approve" && "Approve"}
                {actionType === "request_changes" && "Request changes"}
                {actionType === "reject" && "Reject"}
              </DialogTitle>
              <DialogDescription>
                {actionType === "permanent_delete"
                  ? "This will permanently remove the release, tracks, splits, contributors, assets, and related disputes. This cannot be undone."
                  : actionType === "approve" && release?.release_date && new Date(release.release_date) > new Date()
                    ? `This release will be scheduled for publication on ${release.release_date}. A comment is required.`
                    : actionType === "approve"
                      ? "This release will be approved and published immediately. A comment is required."
                      : "This action will be logged. A comment is required."}
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
              {actionType === "permanent_delete" && (
                <div className="space-y-2">
                  <Label htmlFor="confirmDelete" className="text-destructive">Type DELETE to confirm</Label>
                  <Input
                    id="confirmDelete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setActionType(null); setComment(""); setConfirmText("") }} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={runAction}
                variant={actionType === "reject" || actionType === "force_publish" || actionType === "takedown" || actionType === "permanent_delete" ? "destructive" : "default"}
                disabled={submitting || !comment.trim() || (actionType === "permanent_delete" && confirmText.trim().toUpperCase() !== "DELETE")}
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
