"use client"

import { useEffect, useState } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { formatDateTime, formatNumber } from "@/lib/utils"
import {
  Search, Download, TrendingUp, TrendingDown,
  DollarSign, Coins, PlusCircle, MinusCircle,
} from "lucide-react"
import { toast } from "sonner"

interface LedgerEntry {
  id: string; profile_id: string | null; type: string; source: string
  context: string | null; nano_delta: number; mini_delta: number
  status: string; created_at: string
  profiles: { email: string } | null
}
interface FanWallet {
  id: string; profile_id: string; nano_balance: number
  mini_balance: number; wave_coin_balance: number; updated_at: string
  profiles: { email: string } | null
}

export default function WalletsPage() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [wallets, setWallets] = useState<FanWallet[]>([])
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ nano: 0, mini: 0, entries: 0 })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [ledgerRes, walletsRes] = await Promise.all([
        supabase.from("ledger_entries")
          .select("id,profile_id,type,source,context,nano_delta,mini_delta,status,created_at,profiles(email)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("fan_wallets")
          .select("id,profile_id,nano_balance,mini_balance,wave_coin_balance,updated_at,profiles(email)")
          .order("nano_balance", { ascending: false })
          .limit(50),
      ])
      const entries = (ledgerRes.data ?? []) as LedgerEntry[]
      setLedger(entries)
      setWallets((walletsRes.data ?? []) as FanWallet[])
      const nanoTotal = entries.reduce((s, e) => s + (e.nano_delta ?? 0), 0)
      const miniTotal = entries.reduce((s, e) => s + (e.mini_delta ?? 0), 0)
      setTotals({ nano: nanoTotal, mini: miniTotal, entries: entries.length })
      setLoading(false)
    }
    load()
  }, [])

  const filtered = ledger.filter(e => {
    const matchSearch = !search || (e.profiles as any)?.email?.includes(search) || e.source.includes(search)
    const matchSource = sourceFilter === "all" || e.source === sourceFilter
    return matchSearch && matchSource
  })

  return (
    <div>
      <AdminTopbar title="Wallets & Ledger" subtitle="Financial operations" />
      <div className="p-6 max-w-[1400px] space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Ledger Entries", value: formatNumber(totals.entries), icon: DollarSign, sub: "all time" },
            { label: "Net Nano Δ (last 100)", value: `${totals.nano >= 0 ? "+" : ""}${totals.nano.toFixed(2)}`, icon: TrendingUp, sub: "recent window" },
            { label: "Net Mini Δ (last 100)", value: `${totals.mini >= 0 ? "+" : ""}${totals.mini.toFixed(2)}`, icon: TrendingDown, sub: "recent window" },
            { label: "Active Wallets",        value: formatNumber(wallets.length), icon: Coins, sub: "fan wallets" },
          ].map(c => {
            const Icon = c.icon
            return (
              <Card key={c.label}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <p className="text-xl font-bold text-foreground font-mono">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                  <p className="text-[10px] text-muted-foreground/60">{c.sub}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Tabs defaultValue="ledger">
          <TabsList>
            <TabsTrigger value="ledger">Ledger Explorer</TabsTrigger>
            <TabsTrigger value="wallets">Fan Wallets</TabsTrigger>
            <TabsTrigger value="adjust">Manual Adjustment</TabsTrigger>
          </TabsList>

          {/* Ledger */}
          <TabsContent value="ledger" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input placeholder="Search email or source…" className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="streams">Streams</SelectItem>
                  <SelectItem value="honors">Honors</SelectItem>
                  <SelectItem value="rooms">Rooms</SelectItem>
                  <SelectItem value="bonuses">Bonuses</SelectItem>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="drop_fee">Drop Fee</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5 ml-auto">
                <Download className="size-3.5" /> Export Slice
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Context</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Nano Δ</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Mini Δ</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                        ))}</tr>
                      )) : filtered.map(e => (
                        <tr key={e.id} className="hover:bg-secondary/20">
                          <td className="px-4 py-3 text-xs text-muted-foreground">{(e.profiles as any)?.email ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className={`flex items-center gap-1 text-xs font-medium ${e.type === "earn" ? "text-success" : "text-destructive"}`}>
                              {e.type === "earn" ? <PlusCircle className="size-3" /> : <MinusCircle className="size-3" />}
                              {e.type}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{e.source.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{e.context ?? "—"}</td>
                          <td className={`px-4 py-3 font-mono text-xs font-medium ${e.nano_delta >= 0 ? "text-success" : "text-destructive"}`}>
                            {e.nano_delta >= 0 ? "+" : ""}{e.nano_delta}
                          </td>
                          <td className={`px-4 py-3 font-mono text-xs font-medium ${e.mini_delta >= 0 ? "text-success" : "text-destructive"}`}>
                            {e.mini_delta >= 0 ? "+" : ""}{e.mini_delta}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={e.status === "settled" ? "secondary" : "outline"} className="text-xs capitalize">{e.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(e.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fan Wallets */}
          <TabsContent value="wallets" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Nano</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Mini</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Wave Coin</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                      ))}</tr>
                    )) : wallets.map(w => (
                      <tr key={w.id} className="hover:bg-secondary/20">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{(w.profiles as any)?.email ?? w.profile_id.slice(0, 8)}</td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{w.nano_balance.toFixed(4)}</td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{w.mini_balance.toFixed(4)}</td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{w.wave_coin_balance.toFixed(4)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(w.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manual Adjustment */}
          <TabsContent value="adjust" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Manual Ledger Adjustment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create manual credits, debits, or reversals. All adjustments are append-only and require a reason code.
                </p>
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                  <p className="text-sm text-warning font-medium">⚠ High-impact action</p>
                  <p className="text-xs text-muted-foreground mt-1">Manual adjustments above threshold require dual-control approval.</p>
                </div>
                <Button onClick={() => toast.info("Manual adjustment form — coming soon")} variant="outline" className="gap-1.5">
                  <PlusCircle className="size-4" /> Create Adjustment
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
