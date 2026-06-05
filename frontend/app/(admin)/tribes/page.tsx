"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Radio, Camera, Trash2, Upload, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"

interface DjWaveSnapshot {
  artistId: string
  tribeId: string
  name: string
  handle: string | null
  bio: string | null
  memberCount: number
  visibility: string
  avatarRef: string | null
  avatarUrl: string | null
}

interface PostRow {
  id: string
  type: string
  status: string
  title: string | null
  body: string | null
  media_urls: string[] | null
  source_url: string | null
  created_at: string
}

export default function TribesPage() {
  const [snap, setSnap] = useState<DjWaveSnapshot | null>(null)
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Post composer state
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        api.get<DjWaveSnapshot>("/tribes/dj-wave"),
        api.get<PostRow[]>("/tribes/dj-wave/posts"),
      ])
      setSnap(s)
      setPosts(p ?? [])
    } catch (e: any) {
      toast.error(`Failed to load tribe: ${e.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const uploadToSupabase = async (signedUrl: string, file: File) => {
    const res = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Upload failed (${res.status}): ${text}`)
    }
  }

  const handleAvatarPick = async (file: File) => {
    setAvatarUploading(true)
    try {
      const { signedUrl, path } = await api.post<{ signedUrl: string; path: string }>(
        "/tribes/dj-wave/avatar/upload",
        { filename: file.name },
      )
      await uploadToSupabase(signedUrl, file)
      const next = await api.post<DjWaveSnapshot>("/tribes/dj-wave/avatar", { path })
      setSnap(next)
      toast.success("Avatar updated")
    } catch (e: any) {
      toast.error(`Avatar upload failed: ${e.message ?? e}`)
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ""
    }
  }

  const handlePostSubmit = async () => {
    if (!body.trim() && !mediaFile) {
      toast.error("Add a body or attach an image")
      return
    }
    setSubmitting(true)
    try {
      let mediaUrls: string[] | null = null
      if (mediaFile) {
        const { signedUrl, publicUrl } = await api.post<{ signedUrl: string; publicUrl: string }>(
          "/tribes/dj-wave/posts/media/upload",
          { filename: mediaFile.name },
        )
        await uploadToSupabase(signedUrl, mediaFile)
        mediaUrls = [publicUrl]
      }
      await api.post("/tribes/dj-wave/posts", {
        type: "announcement",
        title: title.trim() || null,
        body: body.trim() || null,
        media_urls: mediaUrls,
      })
      setTitle("")
      setBody("")
      setMediaFile(null)
      if (mediaInputRef.current) mediaInputRef.current.value = ""
      await load()
      toast.success("Post published")
    } catch (e: any) {
      toast.error(`Publish failed: ${e.message ?? e}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post? Attached media will also be removed.")) return
    try {
      await api.delete(`/tribes/dj-wave/posts/${id}`)
      setPosts((prev) => prev.filter((p) => p.id !== id))
      toast.success("Post deleted")
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message ?? e}`)
    }
  }

  return (
    <div>
      <AdminTopbar title="Tribes" subtitle="DJ Wave — the platform's official voice" />
      <div className="p-6 max-w-[1100px] space-y-6">

        {/* DJ Wave identity */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-orange-500" />
              <CardTitle className="text-sm">DJ Wave tribe</CardTitle>
            </div>
            <CardDescription>
              Every user is auto-joined to this tribe and cannot leave. Posts published here appear in every fan's tribe feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="size-20 rounded-full overflow-hidden border border-border bg-secondary/30 flex items-center justify-center">
                  {snap?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={snap.avatarUrl} alt="DJ Wave avatar" className="size-full object-cover" />
                  ) : (
                    <Camera className="size-6 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleAvatarPick(f)
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute -bottom-2 -right-2 h-7 px-2 text-[10px]"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading || loading}
                >
                  {avatarUploading ? "..." : "Change"}
                </Button>
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-base font-semibold">{snap?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  @{snap?.handle ?? "—"} · {snap?.memberCount?.toLocaleString() ?? 0} members · {snap?.visibility ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground italic">
                  {snap?.bio ?? "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Composer */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Publish a post</CardTitle>
            <CardDescription>Goes live immediately to every fan's DJ Wave feed.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs">Title (optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New episode out now"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body" className="text-xs">Body</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What's the announcement?"
                rows={4}
                maxLength={4000}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image (optional)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mediaInputRef.current?.click()}
                  type="button"
                >
                  <Upload className="size-3.5 mr-1.5" />
                  {mediaFile ? "Change image" : "Attach image"}
                </Button>
                {mediaFile && (
                  <div className="text-xs text-muted-foreground truncate flex-1">
                    {mediaFile.name}
                  </div>
                )}
                {mediaFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMediaFile(null)
                      if (mediaInputRef.current) mediaInputRef.current.value = ""
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handlePostSubmit} disabled={submitting || loading}>
                {submitting ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Posts list */}
        <Card className="border-border bg-card">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Published posts</CardTitle>
            <CardDescription>Most recent first</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-secondary/30">
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Body</TableHead>
                    <TableHead className="text-xs">Media</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i} className="border-border">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}><div className="h-4 rounded bg-secondary animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : posts.length === 0 ? (
                    <TableRow className="border-border">
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                        No posts yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    posts.map((p) => (
                      <TableRow key={p.id} className="border-border">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(p.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[200px] truncate">{p.title || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[360px]">
                          <div className="line-clamp-2">{p.body || "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.media_urls && p.media_urls.length > 0 ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <ImageIcon className="size-3.5" />
                              {p.media_urls.length}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(p.id)}
                            className="h-7 px-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
