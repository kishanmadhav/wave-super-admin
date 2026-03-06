"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { formatDate, truncate } from "@/lib/utils"
import { Search, Download, Radio, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

const STATUS_BADGE: Record<string, string> = {
  draft:              "bg-secondary text-secondary-foreground",
  submitted:          "bg-primary/15 text-primary",
  under_review:       "bg-primary/15 text-primary",
  approved:           "bg-success/15 text-success",
  published:          "bg-success/15 text-success",
  changes_requested:  "bg-warning/15 text-warning",
  rejected:           "bg-destructive/15 text-destructive",
  takedown:           "bg-destructive/15 text-destructive",
}

interface Release {
  id: string; title: string; primary_artist: string; status: string
  type: string; release_date: string | null; created_at: string
  metadata_completeness_score: number | null
}
interface Track {
  id: string; title: string; isrc: string | null; upload_status: string
  created_at: string; releases: { title: string } | null
}

export default function CatalogPage() {
  const [releases, setReleases] = useState<Release[]>([])
  const [tracks, setTracks]   = useState<Track[]>([])
  const [search, setSearch]   = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [totalReleases, setTotalReleases] = useState(0)
  const [totalTracks, setTotalTracks]   = useState(0)

  const loadReleases = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from("releases")
      .select("id,title,primary_artist,status,type,release_date,created_at,metadata_completeness_score", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(50)
    if (search) q = q.ilike("title", `%${search}%`)
    if (statusFilter !== "all") q = q.eq("status", statusFilter)
    const { data, count } = await q
    setReleases(data ?? [])
    setTotalReleases(count ?? 0)
    setLoading(false)
  }, [search, statusFilter])

  const loadTracks = useCallback(async () => {
    let q = supabase
      .from("tracks")
      .select("id,title,isrc,upload_status,created_at,releases(title)", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(50)
    if (search) q = q.ilike("title", `%${search}%`)
    const { data, count } = await q
    setTracks((data ?? []) as Track[])
    setTotalTracks(count ?? 0)
  }, [search])

  useEffect(() => {
    loadReleases()
    loadTracks()
  }, [loadReleases, loadTracks])

  return (
    <div>
      <AdminTopbar title="Catalog" subtitle="Releases, Tracks & Assets" />
      <div className="p-6 max-w-[1400px] space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input placeholder="Search by title…" className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="changes_requested">Changes Requested</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="takedown">Takedown</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="size-3.5" />Export</Button>
          </div>
        </div>

        <Tabs defaultValue="releases">
          <TabsList>
            <TabsTrigger value="releases">Releases ({totalReleases})</TabsTrigger>
            <TabsTrigger value="tracks">Tracks ({totalTracks})</TabsTrigger>
          </TabsList>

          <TabsContent value="releases" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Release</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Artist</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Score</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Release Date</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                        ))}</tr>
                      )) : releases.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No releases found</td></tr>
                      ) : releases.map(r => (
                        <tr key={r.id} className="hover:bg-secondary/20">
                          <td className="px-4 py-3 font-medium text-foreground">{truncate(r.title, 30)}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{truncate(r.primary_artist, 24)}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs capitalize">{r.type}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[r.status] ?? "bg-secondary text-secondary-foreground"}`}>
                              {r.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.metadata_completeness_score != null ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                                  <div className={`h-full rounded-full ${r.metadata_completeness_score >= 80 ? "bg-success" : r.metadata_completeness_score >= 50 ? "bg-warning" : "bg-destructive"}`}
                                    style={{ width: `${r.metadata_completeness_score}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground">{r.metadata_completeness_score}%</span>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.release_date)}</td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => toast.info("Force publish — coming soon")}>Force Publish</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info("Schedule — coming soon")}>Schedule</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => toast.info("Takedown — coming soon")}>Takedown</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tracks" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Track</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Release</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">ISRC</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Audio</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tracks.map(t => (
                      <tr key={t.id} className="hover:bg-secondary/20">
                        <td className="px-4 py-3 font-medium text-foreground">{truncate(t.title, 30)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{(t.releases as any)?.title ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{t.isrc ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={t.upload_status === "complete" ? "secondary" : "destructive"} className="text-xs capitalize">
                            {t.upload_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
