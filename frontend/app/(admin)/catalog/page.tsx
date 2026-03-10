"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { formatDate, truncate } from "@/lib/utils"
import { Search, Download, MoreHorizontal, ChevronRight, Disc3 } from "lucide-react"
import { toast } from "sonner"

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/15 text-primary",
  under_review: "bg-primary/15 text-primary",
  approved: "bg-success/15 text-success",
  published: "bg-success/15 text-success",
  changes_requested: "bg-warning/15 text-warning",
  rejected: "bg-destructive/15 text-destructive",
  takedown: "bg-destructive/15 text-destructive",
}

interface Release {
  id: string
  title: string
  primary_artist: string
  status: string
  type: string
  release_date: string | null
  created_at: string
  metadata_completeness_score: number | null
}

interface Paged<T> {
  data: T[]
  total: number
}

const PENDING_STATUSES = ["draft", "submitted", "under_review"]
const CHANGES_STATUSES = ["changes_requested"]
const APPROVED_STATUSES = ["approved", "published"]
const REJECTED_STATUSES = ["rejected", "takedown"]

export default function CatalogPage() {
  const [releases, setReleases] = useState<Release[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [queueTab, setQueueTab] = useState("pending")

  const loadReleases = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<Paged<Release>>("/catalog/releases", {
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        limit: 100,
        offset: 0,
      })
      setReleases(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load releases")
      setReleases([])
      setTotal(0)
    }
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    loadReleases()
  }, [loadReleases])

  const pending = releases.filter((r) => PENDING_STATUSES.includes(r.status))
  const changesReq = releases.filter((r) => CHANGES_STATUSES.includes(r.status))
  const approved = releases.filter((r) => APPROVED_STATUSES.includes(r.status))
  const rejected = releases.filter((r) => REJECTED_STATUSES.includes(r.status))

  const tabItems: Record<string, Release[]> = {
    pending,
    changes_requested: changesReq,
    approved,
    rejected,
  }
  const currentReleases = tabItems[queueTab] ?? pending

  return (
    <div>
      <AdminTopbar title="Catalog" subtitle="Release verification queue" />
      <div className="p-6 max-w-[1400px] space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Pending", count: pending.length, tab: "pending" },
            { label: "Changes requested", count: changesReq.length, tab: "changes_requested" },
            { label: "Approved / Published", count: approved.length, tab: "approved" },
            { label: "Rejected / Takedown", count: rejected.length, tab: "rejected" },
            { label: "Total", count: total, tab: null },
          ].map((s) => (
            <Card key={s.label} className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{s.count}</p>
                {s.tab && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={() => setQueueTab(s.tab!)}
                  >
                    View
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title or artist…"
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
              <SelectItem value="changes_requested">Changes requested</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="takedown">Takedown</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* Queue tabs */}
        <Tabs value={queueTab} onValueChange={setQueueTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="changes_requested">Changes requested ({changesReq.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved / Published ({approved.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected / Takedown ({rejected.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={queueTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Release</TableHead>
                      <TableHead>Artist</TableHead>
                      <TableHead className="w-24">Type</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-20">Score</TableHead>
                      <TableHead className="w-28">Release date</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><div className="h-4 rounded bg-muted animate-pulse w-4" /></TableCell>
                          <TableCell><div className="h-4 rounded bg-muted animate-pulse w-32" /></TableCell>
                          <TableCell><div className="h-4 rounded bg-muted animate-pulse w-24" /></TableCell>
                          <TableCell><div className="h-4 rounded bg-muted animate-pulse w-16" /></TableCell>
                          <TableCell><div className="h-4 rounded bg-muted animate-pulse w-20" /></TableCell>
                          <TableCell><div className="h-4 rounded bg-muted animate-pulse w-16" /></TableCell>
                          <TableCell><div className="h-4 rounded bg-muted animate-pulse w-20" /></TableCell>
                          <TableCell><div className="h-4 rounded bg-muted animate-pulse w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : currentReleases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                          No releases in this category
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentReleases.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell>
                            <Disc3 className="size-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            <Link href={`/catalog/releases/${r.id}`} className="hover:text-primary transition-colors">
                              {truncate(r.title, 36)}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{truncate(r.primary_artist, 24)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{r.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[r.status] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {r.status.replace(/_/g, " ")}
                            </span>
                          </TableCell>
                          <TableCell>
                            {r.metadata_completeness_score != null ? (
                              <span className="text-xs text-muted-foreground">{r.metadata_completeness_score}%</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{formatDate(r.release_date)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                              <Link href={`/catalog/releases/${r.id}`}>
                                Open <ChevronRight className="size-3" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
