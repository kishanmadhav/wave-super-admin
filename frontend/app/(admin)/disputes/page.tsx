"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { formatDateTime, truncate } from "@/lib/utils"
import { Search, AlertTriangle, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface Dispute {
  id: string; type: string; target_type: string; target_name: string | null
  severity: string; status: string; claimant_name: string | null
  created_at: string; priority: number | null
}

const SEVERITY_BADGE: Record<string, string> = {
  low:      "bg-secondary text-secondary-foreground border-border",
  medium:   "bg-primary/15 text-primary border-primary/30",
  high:     "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
}

const STATUS_BADGE: Record<string, string> = {
  open:                        "bg-primary/15 text-primary",
  awaiting_uploader_response:  "bg-warning/15 text-warning",
  awaiting_claimant_response:  "bg-warning/15 text-warning",
  under_review:                "bg-primary/15 text-primary",
  escalated:                   "bg-destructive/15 text-destructive",
  resolved:                    "bg-success/15 text-success",
  closed:                      "bg-secondary text-secondary-foreground",
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase
        .from("disputes")
        .select("id,type,target_type,target_name,severity,status,claimant_name,created_at,priority", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(50)
      if (search) q = q.or(`target_name.ilike.%${search}%,claimant_name.ilike.%${search}%`)
      if (statusFilter === "active") q = q.in("status", ["open", "under_review", "escalated", "awaiting_uploader_response", "awaiting_claimant_response"])
      else if (statusFilter !== "all") q = q.eq("status", statusFilter)
      const { data, count } = await q
      setDisputes(data ?? [])
      setTotal(count ?? 0)
      setLoading(false)
    }
    load()
  }, [search, statusFilter])

  return (
    <div>
      <AdminTopbar title="Disputes & Reports" subtitle={`${total} total`} />
      <div className="p-6 max-w-[1400px] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input placeholder="Search target or claimant…" className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Target</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Claimant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Raised</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                    ))}</tr>
                  )) : disputes.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No disputes found</td></tr>
                  ) : disputes.map(d => (
                    <tr key={d.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <span className="capitalize text-xs text-muted-foreground">{d.type.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-foreground font-medium text-sm">{truncate(d.target_name, 28) ?? "—"}</p>
                          <p className="text-xs text-muted-foreground capitalize">{d.target_type}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{d.claimant_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${SEVERITY_BADGE[d.severity]}`}>
                          {d.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[d.status] ?? ""}`}>
                          {d.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(d.created_at)}</td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild><Link href={`/disputes/${d.id}`}>View Detail</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Assign — coming soon")}>Assign to me</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Resolve — coming soon")}>Mark Resolved</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => toast.info("Escalate — coming soon")}>Escalate</DropdownMenuItem>
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
      </div>
    </div>
  )
}
