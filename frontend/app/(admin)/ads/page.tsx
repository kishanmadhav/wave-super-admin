"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Megaphone, Music, Image as ImageIcon, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"

type Placement = "banner" | "interstitial"

interface AdRow {
  id: string
  placement: Placement
  title: string
  subtitle: string | null
  cta_label: string | null
  cta_url: string | null
  image_path: string
  audio_path: string | null
  image_url: string | null
  audio_url: string | null
  nano_reward: number
  duration_sec: number
  display_order: number
  active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

export default function AdsPage() {
  const [tab, setTab] = useState<Placement>("banner")
  const [ads, setAds] = useState<AdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<AdRow[]>("/ads")
      setAds(data ?? [])
    } catch (err: any) {
      toast.error(`Failed to load ads: ${err.message ?? err}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => ads.filter((a) => a.placement === tab), [ads, tab])

  const toggleActive = async (ad: AdRow, next: boolean) => {
    try {
      await api.patch(`/ads/${ad.id}`, { active: next })
      setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, active: next } : a)))
    } catch (err: any) {
      toast.error(err.message ?? "Update failed")
    }
  }

  const remove = async (ad: AdRow) => {
    if (!confirm(`Delete "${ad.title}"? This deletes the ad and its uploaded media.`)) return
    try {
      await api.delete(`/ads/${ad.id}`)
      setAds((prev) => prev.filter((a) => a.id !== ad.id))
      toast.success("Ad deleted")
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed")
    }
  }

  return (
    <>
      <AdminTopbar title="Ad Management" />
      <div className="p-6 space-y-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="size-5" /> Ad Management
                </CardTitle>
                <CardDescription>
                  Upload banners shown on the Watch &amp; Earn screen and playable ads
                  that fire between songs in the mobile app.
                </CardDescription>
              </div>
              <Button onClick={() => setCreating(true)}>
                <Plus className="mr-2 size-4" /> New ad
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as Placement)}>
              <TabsList>
                <TabsTrigger value="banner">
                  <ImageIcon className="mr-2 size-4" /> Banners (Watch &amp; Earn)
                </TabsTrigger>
                <TabsTrigger value="interstitial">
                  <Music className="mr-2 size-4" /> Playable (between songs)
                </TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Preview</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Reward</TableHead>
                      <TableHead>{tab === "banner" ? "Duration" : "Audio"}</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No ads yet</TableCell></TableRow>
                    ) : (
                      filtered.map((ad) => (
                        <TableRow key={ad.id}>
                          <TableCell>
                            {ad.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ad.image_url} alt="" className="size-10 rounded object-cover" />
                            ) : (
                              <div className="size-10 rounded bg-muted" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{ad.title}</div>
                            {ad.subtitle && <div className="text-xs text-muted-foreground">{ad.subtitle}</div>}
                          </TableCell>
                          <TableCell><Badge variant="secondary">+{ad.nano_reward} Nano</Badge></TableCell>
                          <TableCell>
                            {tab === "banner" ? `${ad.duration_sec}s` : ad.audio_path ? "Yes" : "Missing"}
                          </TableCell>
                          <TableCell>{ad.display_order}</TableCell>
                          <TableCell>
                            <Switch checked={ad.active} onCheckedChange={(v) => toggleActive(ad, v)} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => remove(ad)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {creating && (
          <NewAdDialog
            placement={tab}
            onClose={() => setCreating(false)}
            onCreated={() => { setCreating(false); load() }}
          />
        )}
      </div>
    </>
  )
}

function NewAdDialog({
  placement,
  onClose,
  onCreated,
}: {
  placement: Placement
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [ctaLabel, setCtaLabel] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [nanoReward, setNanoReward] = useState<number>(1)
  const [durationSec, setDurationSec] = useState<number>(10)
  const [displayOrder, setDisplayOrder] = useState<number>(0)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const needsAudio = placement === "interstitial"

  const uploadOne = async (kind: "image" | "audio", file: File): Promise<string> => {
    // 1. Mint signed upload URL via NestJS (which uses service-role).
    const { signedUrl, path } = await api.post<{ signedUrl: string; path: string }>(
      "/ads/uploads",
      { placement, kind, filename: file.name },
    )
    // 2. PUT the file to that URL directly.
    const res = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Upload failed (${res.status}): ${text}`)
    }
    return path
  }

  const submit = async () => {
    if (!title.trim()) { toast.error("Title is required"); return }
    if (!imageFile) { toast.error("Image is required"); return }
    if (needsAudio && !audioFile) { toast.error("Audio is required for playable ads"); return }
    if (nanoReward < 0 || nanoReward > 50) { toast.error("Reward must be between 0 and 50"); return }

    setSubmitting(true)
    try {
      const imagePath = await uploadOne("image", imageFile)
      const audioPath = audioFile ? await uploadOne("audio", audioFile) : null

      await api.post("/ads", {
        placement,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        cta_label: ctaLabel.trim() || null,
        cta_url: ctaUrl.trim() || null,
        image_path: imagePath,
        audio_path: audioPath,
        nano_reward: nanoReward,
        duration_sec: durationSec,
        display_order: displayOrder,
        active,
      })

      toast.success("Ad created")
      onCreated()
    } catch (err: any) {
      toast.error(`Failed: ${err.message ?? err}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New {placement === "banner" ? "Banner" : "Playable"} Ad</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Running Shoes" />
          </div>
          <div>
            <Label>Subtitle / brand</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Nike Air Max" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CTA label</Label>
              <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Buy now" />
            </div>
            <div>
              <Label>CTA URL</Label>
              <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Nano reward</Label>
              <Input type="number" min={0} max={50} value={nanoReward}
                onChange={(e) => setNanoReward(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Duration (s)</Label>
              <Input type="number" min={1} value={durationSec} disabled={needsAudio}
                onChange={(e) => setDurationSec(Number(e.target.value) || 1)} />
              {needsAudio && <p className="text-xs text-muted-foreground mt-1">Uses audio length</p>}
            </div>
            <div>
              <Label>Order</Label>
              <Input type="number" value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label>Image</Label>
            <Input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          </div>
          {needsAudio && (
            <div>
              <Label>Audio</Label>
              <Input type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-m4a"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label className="!mt-0">Active on save</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Uploading…" : "Create ad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
