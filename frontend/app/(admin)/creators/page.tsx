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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDateTime, initials, truncate } from "@/lib/utils"
import { Search, Download, ShieldCheck, ShieldOff, MoreHorizontal, UserX, Plus, BadgeCheck } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { api } from "@/lib/api"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

// Creator profile from GET /users (unified list)
interface CreatorProfile {
  id: string
  email: string
  username: string | null
  org_name: string | null
  account_type: string | null
  country: string | null
  created_at: string
  deletion_pending: boolean
  fraud_flagged: boolean | null
  suspended_at: string | null
  banned_at: string | null
  display_name: string
}

interface Artist {
  id: string
  name: string
  handle: string
  location: string | null
  followers: number
  created_at: string
  profile_id: string | null
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

interface Paged<T> {
  data: T[]
  total: number
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  suspended: "bg-warning/15 text-warning border-warning/30",
  banned: "bg-destructive/15 text-destructive border-destructive/30",
  flagged: "bg-orange-500/15 text-orange-400 border-orange-500/30",
}

function creatorStatus(p: CreatorProfile) {
  if (p.banned_at) return "banned"
  if (p.suspended_at) return "suspended"
  if (p.fraud_flagged) return "flagged"
  if (p.deletion_pending) return "pending deletion"
  return "active"
}

export default function CreatorsPage() {
  const [creators, setCreators] = useState<CreatorProfile[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("wave_admin")
  const [creating, setCreating] = useState(false)

  const [artists, setArtists] = useState<Artist[]>([])
  const [labels, setLabels] = useState<LabelProfile[]>([])
  const [artistsLabelsLoading, setArtistsLabelsLoading] = useState(false)

  const loadCreators = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<Paged<CreatorProfile>>("/users", {
        search: search || undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        limit: 50,
        offset: 0,
      })
      setCreators(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load creators")
      setCreators([])
      setTotal(0)
    }
    setLoading(false)
  }, [search, typeFilter, statusFilter])

  useEffect(() => {
    loadCreators()
  }, [loadCreators])

  const loadArtistsAndLabels = useCallback(async () => {
    setArtistsLabelsLoading(true)
    try {
      const [a, l] = await Promise.all([
        api.get<{ data: Artist[] }>("/creators/artists", { search: search || undefined, limit: 50, offset: 0 }),
        api.get<{ data: LabelProfile[] }>("/creators/labels", { search: search || undefined, limit: 50, offset: 0 }),
      ])
      setArtists(a.data ?? [])
      setLabels(l.data ?? [])
    } catch {
      setArtists([])
      setLabels([])
    } finally {
      setArtistsLabelsLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadArtistsAndLabels()
  }, [loadArtistsAndLabels])

  async function suspendUser(id: string) {
    const reason = prompt("Suspend reason?", "Suspended by admin") ?? ""
    if (!reason) return
    try {
      await api.post(`/users/${id}/suspend`, { reason })
      toast.success("Creator suspended")
      loadCreators()
    } catch (e: any) {
      toast.error(e.message ?? "Suspend failed")
    }
  }

  async function unsuspendUser(id: string) {
    try {
      await api.post(`/users/${id}/unsuspend`)
      toast.success("Creator re-enabled")
      loadCreators()
    } catch (e: any) {
      toast.error(e.message ?? "Unsuspend failed")
    }
  }

  async function banUser(id: string) {
    const reason = prompt("Ban reason?", "Banned by admin") ?? ""
    if (!reason) return
    try {
      await api.post(`/users/${id}/ban`, { reason })
      toast.success("Creator banned")
      loadCreators()
    } catch (e: any) {
      toast.error(e.message ?? "Ban failed")
    }
  }

  async function flagFraud(id: string) {
    try {
      await api.post(`/users/${id}/flag-fraud`)
      toast.success("Creator flagged for fraud")
      loadCreators()
    } catch (e: any) {
      toast.error(e.message ?? "Flag failed")
    }
  }

  async function createUser() {
    if (!createEmail || !createPassword) return
    setCreating(true)
    try {
      await api.post("/users", { email: createEmail, password: createPassword })
      toast.success("Creator account created")
      setCreateOpen(false)
      setCreateEmail("")
      setCreatePassword("wave_admin")
      loadCreators()
    } catch (e: any) {
      toast.error(e.message ?? "Create failed")
    } finally {
      setCreating(false)
    }
  }

  function escapeCsvCell(value: string | null | undefined): string {
    if (value == null) return ""
    const s = String(value)
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  function exportCreatorsCsv() {
    const headers = ["Display Name", "Email", "Username", "Org Name", "Account Type", "Country", "Status", "Joined"]
    const rows = creators.map((p) => {
      const status = creatorStatus(p)
      return [
        escapeCsvCell(p.display_name),
        escapeCsvCell(p.email),
        escapeCsvCell(p.username),
        escapeCsvCell(p.org_name),
        escapeCsvCell(p.account_type ?? ""),
        escapeCsvCell(p.country),
        escapeCsvCell(status),
        escapeCsvCell(p.created_at ? formatDateTime(p.created_at) : ""),
      ]
    })
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `creators-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${creators.length} creators as CSV`)
  }

  return (
    <div>
      <AdminTopbar title="Creators" subtitle={`${total} creator accounts`} />
      <div className="p-6 max-w-[1400px] space-y-4">
        <Tabs defaultValue="all">
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="all">All creators ({total})</TabsTrigger>
              <TabsTrigger value="individuals">Individuals ({artists.length})</TabsTrigger>
              <TabsTrigger value="labels">Labels ({labels.length})</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by email, username or org name…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="artist">Artist</SelectItem>
                  <SelectItem value="band">Band</SelectItem>
                  <SelectItem value="label">Label</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                  <SelectItem value="flagged">Fraud flagged</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex gap-2">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      <Plus className="size-3.5" /> Add creator
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create creator account</DialogTitle>
                      <DialogDescription>
                        Creates a Supabase auth user and a profiles row.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="new-email">Email</Label>
                        <Input id="new-email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="user@wave.fm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="new-password">Password</Label>
                        <Input id="new-password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
                      <Button onClick={createUser} disabled={creating || !createEmail || !createPassword}>
                        {creating ? "Creating…" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCreatorsCsv} disabled={loading}>
                  <Download className="size-3.5" /> Export
                </Button>
              </div>
            </div>
          </div>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[min(280px,40%)]">Creator</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead className="w-[80px]">Country</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[140px]">Joined</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><div className="h-5 rounded bg-muted animate-pulse w-40" /></TableCell>
                          <TableCell><div className="h-5 rounded bg-muted animate-pulse w-16" /></TableCell>
                          <TableCell><div className="h-5 rounded bg-muted animate-pulse w-12" /></TableCell>
                          <TableCell><div className="h-5 rounded bg-muted animate-pulse w-16" /></TableCell>
                          <TableCell><div className="h-5 rounded bg-muted animate-pulse w-24" /></TableCell>
                          <TableCell />
                        </TableRow>
                      ))
                    ) : creators.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                          No creators found
                        </TableCell>
                      </TableRow>
                    ) : creators.map((p) => {
                      const status = creatorStatus(p)
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="align-middle">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="size-8 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {initials(p.display_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <Link
                                  href={`/users/${p.id}`}
                                  className="font-medium text-foreground hover:text-primary transition-colors block truncate"
                                >
                                  {truncate(p.display_name, 36)}
                                </Link>
                                <p className="text-xs text-muted-foreground truncate" title={p.email}>
                                  {truncate(p.email, 40)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-middle">
                            {p.account_type ? (
                              <Badge variant="secondary" className="text-xs capitalize">{p.account_type}</Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="align-middle text-muted-foreground text-xs">{p.country ?? "—"}</TableCell>
                          <TableCell className="align-middle">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_COLORS[status] ?? STATUS_COLORS.active}`}>
                              {status}
                            </span>
                          </TableCell>
                          <TableCell className="align-middle text-muted-foreground text-xs whitespace-nowrap">
                            {formatDateTime(p.created_at)}
                          </TableCell>
                          <TableCell className="align-middle">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/users/${p.id}`}>View detail</Link>
                                </DropdownMenuItem>
                                {status === "suspended" ? (
                                  <DropdownMenuItem onClick={() => unsuspendUser(p.id)}>
                                    <UserX className="mr-2 size-4" /> Re-enable
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => suspendUser(p.id)}>
                                    <UserX className="mr-2 size-4" /> Suspend
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => flagFraud(p.id)}>Flag fraud</DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => banUser(p.id)}
                                >
                                  <ShieldOff className="mr-2 size-4" /> Ban
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="individuals" className="mt-4">
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
                    {artistsLabelsLoading ? (
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
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!a.profile_id) return toast.error("Artist has no linked profile")
                                  api.post(`/creators/profiles/${a.profile_id}/verify`).then(() => { toast.success("Verified"); loadCreators(); loadArtistsAndLabels() }).catch((e: any) => toast.error(e.message))
                                }}
                              >
                                <ShieldCheck className="mr-2 size-4" />Verify
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!a.profile_id) return toast.error("Artist has no linked profile")
                                  api.post(`/creators/profiles/${a.profile_id}/unverify`).then(() => { toast.info("Unverified"); loadCreators(); loadArtistsAndLabels() }).catch((e: any) => toast.error(e.message))
                                }}
                              >
                                <ShieldOff className="mr-2 size-4" />Unverify
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-warning"
                                onClick={() => {
                                  if (!a.profile_id) return toast.error("Artist has no linked profile")
                                  const reason = prompt("Disable reason?", "Disabled by admin") ?? ""
                                  if (!reason) return
                                  api.post(`/users/${a.profile_id}/suspend`, { reason }).then(() => { toast.success("Disabled"); loadCreators(); loadArtistsAndLabels() }).catch((e: any) => toast.error(e.message))
                                }}
                              >
                                <ShieldOff className="mr-2 size-4" />Disable creator
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

          <TabsContent value="labels" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Label</TableHead>
                      <TableHead>Legal Entity</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {artistsLabelsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><div className="h-5 rounded bg-muted animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : labels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground text-sm">No labels found</TableCell>
                      </TableRow>
                    ) : labels.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {l.label_name ?? "—"}
                            {l.verification_status === "verified" && (
                              <BadgeCheck className="size-4 shrink-0 text-blue-500" aria-label="Verified" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{l.legal_entity_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{l.registered_country ?? "—"}</TableCell>
                        <TableCell>
                          {l.verification_status === "verified" ? (
                            <Badge variant="secondary" className="text-xs">Verified</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs capitalize">{l.verification_status ?? "unverified"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatDateTime(l.created_at)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!l.profile_id) return toast.error("Label has no linked profile")
                                  api.post(`/creators/profiles/${l.profile_id}/verify`).then(() => { toast.success("Verified"); loadCreators(); loadArtistsAndLabels() }).catch((e: any) => toast.error(e.message))
                                }}
                              >
                                <ShieldCheck className="mr-2 size-4" />Verify
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!l.profile_id) return toast.error("Label has no linked profile")
                                  api.post(`/creators/profiles/${l.profile_id}/unverify`).then(() => { toast.info("Unverified"); loadCreators(); loadArtistsAndLabels() }).catch((e: any) => toast.error(e.message))
                                }}
                              >
                                <ShieldOff className="mr-2 size-4" />Unverify
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-warning"
                                onClick={() => {
                                  if (!l.profile_id) return toast.error("Label has no linked profile")
                                  const reason = prompt("Disable reason?", "Disabled by admin") ?? ""
                                  if (!reason) return
                                  api.post(`/users/${l.profile_id}/suspend`, { reason }).then(() => { toast.success("Disabled"); loadCreators(); loadArtistsAndLabels() }).catch((e: any) => toast.error(e.message))
                                }}
                              >
                                <ShieldOff className="mr-2 size-4" />Disable creator
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
        </Tabs>
      </div>
    </div>
  )
}
