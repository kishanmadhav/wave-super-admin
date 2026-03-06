"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { formatDateTime, truncate } from "@/lib/utils"
import { Search, Download, Filter } from "lucide-react"

interface AuditLog {
  id: string; admin_id: string; action: string; entity_type: string
  entity_id: string | null; impersonated_as: string | null
  origin_screen: string | null; ip_address: string | null
  created_at: string; admin_users: { profiles: { email: string } | null } | null
}

const ACTION_COLOR: Record<string, string> = {
  create:    "bg-success/15 text-success",
  update:    "bg-primary/15 text-primary",
  delete:    "bg-destructive/15 text-destructive",
  approve:   "bg-success/15 text-success",
  reject:    "bg-destructive/15 text-destructive",
  suspend:   "bg-warning/15 text-warning",
  ban:       "bg-destructive/15 text-destructive",
  impersonate: "bg-orange-500/15 text-orange-400",
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from("audit_logs")
      .select("id,admin_id,action,entity_type,entity_id,impersonated_as,origin_screen,ip_address,created_at,admin_users(profiles(email))", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(100)
    if (actionFilter !== "all") q = q.eq("action", actionFilter)
    if (entityFilter !== "all") q = q.eq("entity_type", entityFilter)
    const { data, count } = await q
    setLogs((data ?? []) as AuditLog[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [actionFilter, entityFilter])

  useEffect(() => { load() }, [load])

  const filtered = logs.filter(l => {
    if (!search) return true
    const email = ((l.admin_users as any)?.profiles as any)?.email ?? ""
    return email.includes(search) || l.action.includes(search) || l.entity_type.includes(search)
  })

  return (
    <div>
      <AdminTopbar title="Audit Log" subtitle={`${total} entries`} />
      <div className="p-6 max-w-[1400px] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input placeholder="Search admin email or action…" className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
              <SelectItem value="suspend">Suspend</SelectItem>
              <SelectItem value="ban">Ban</SelectItem>
              <SelectItem value="impersonate">Impersonate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              <SelectItem value="profile">Profile</SelectItem>
              <SelectItem value="release">Release</SelectItem>
              <SelectItem value="track">Track</SelectItem>
              <SelectItem value="dispute">Dispute</SelectItem>
              <SelectItem value="ledger">Ledger</SelectItem>
              <SelectItem value="feature_flag">Feature Flag</SelectItem>
              <SelectItem value="platform_param">Platform Param</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 ml-auto">
            <Download className="size-3.5" /> Export
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Admin</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Entity ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Screen</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Impersonating</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                    ))}</tr>
                  )) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No audit entries found</td></tr>
                  ) : filtered.map(l => (
                    <tr key={l.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {((l.admin_users as any)?.profiles as any)?.email ?? l.admin_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${ACTION_COLOR[l.action] ?? "bg-secondary text-secondary-foreground"}`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{l.entity_type}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{truncate(l.entity_id, 12) ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.origin_screen ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{l.ip_address ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {l.impersonated_as ? (
                          <Badge variant="destructive" className="text-[10px]">Yes</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
