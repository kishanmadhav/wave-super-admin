"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabase"
import { formatDateTime, initials, truncate } from "@/lib/utils"
import { Search, Filter, Download, MoreHorizontal, UserX, ShieldOff } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface Profile {
  id: string
  email: string
  username: string | null
  account_type: string | null
  country: string | null
  created_at: string
  deletion_pending: boolean
  fraud_flagged: boolean | null
  suspended_at: string | null
  banned_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-success/15 text-success border-success/30",
  suspended: "bg-warning/15 text-warning border-warning/30",
  banned:    "bg-destructive/15 text-destructive border-destructive/30",
  flagged:   "bg-orange-500/15 text-orange-400 border-orange-500/30",
}

function profileStatus(p: Profile) {
  if (p.banned_at) return "banned"
  if (p.suspended_at) return "suspended"
  if (p.fraud_flagged) return "flagged"
  if (p.deletion_pending) return "pending deletion"
  return "active"
}

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from("profiles")
      .select("id,email,username,account_type,country,created_at,deletion_pending,fraud_flagged,suspended_at,banned_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(50)

    if (search) q = q.or(`email.ilike.%${search}%,username.ilike.%${search}%`)
    if (typeFilter !== "all") q = q.eq("account_type", typeFilter)
    if (statusFilter === "suspended") q = q.not("suspended_at", "is", null)
    if (statusFilter === "banned") q = q.not("banned_at", "is", null)
    if (statusFilter === "flagged") q = q.eq("fraud_flagged", true)

    const { data, count } = await q
    setProfiles(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [search, typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <AdminTopbar title="Users" subtitle={`${total} total accounts`} />
      <div className="p-6 space-y-4 max-w-[1400px]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search email or username…"
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Account type" />
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
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Joined</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 rounded bg-secondary animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : profiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No users found
                      </td>
                    </tr>
                  ) : profiles.map((p) => {
                    const status = profileStatus(p)
                    return (
                      <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-7 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {initials(p.username ?? p.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link href={`/users/${p.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                                {truncate(p.username ?? p.email, 28)}
                              </Link>
                              <p className="text-xs text-muted-foreground">{truncate(p.email, 32)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {p.account_type ? (
                            <Badge variant="secondary" className="text-xs capitalize">{p.account_type}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.country ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_COLORS[status] ?? STATUS_COLORS.active}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(p.created_at)}</td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/users/${p.id}`}>View detail</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast.info("Suspend action — coming soon")}>
                                <UserX className="mr-2 size-4" /> Suspend
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => toast.info("Ban action — coming soon")}>
                                <ShieldOff className="mr-2 size-4" /> Ban
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
