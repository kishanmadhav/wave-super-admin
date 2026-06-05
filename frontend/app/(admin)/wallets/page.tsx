"use client"

import { useState, useEffect, useCallback } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDateTime, formatNumber } from "@/lib/utils"
import {
  Search,
  Coins,
  Wallet,
  Award,
  Users,
  Zap,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Music,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformSummary {
  totalNanoWaveIssued: number
  totalMiniWaveSpendable: number
  totalArtistNanoEarned: number
  totalLabelNanoEarned: number
  totalHonorsVolume: number
  totalUsersWithBalances: number
}

interface MobileWalletRow {
  userId: string
  userName: string
  email: string | null
  nanoEarnedTotal: number
  miniBalance: number
  updatedAt: string
}

interface ArtistWalletRow {
  artistId: string
  artistName: string
  handle: string | null
  nanoEarned: number
  updatedAt: string
}

interface LabelWalletRow {
  labelProfileId: string
  labelName: string
  legalEntityName: string | null
  nanoEarned: number
  updatedAt: string
}

interface LedgerEntry {
  id: string
  entry_type: string
  source_type: string
  source_reference_id: string | null
  description: string
  nano_delta: number
  mini_delta?: number
  created_at: string
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary, loading }: { summary: PlatformSummary | null; loading: boolean }) {
  const cards: { label: string; value: string; icon: React.ElementType }[] = summary
    ? [
        { label: "Total NanoWave issued", value: formatNumber(summary.totalNanoWaveIssued), icon: Coins },
        { label: "Total MiniWave spendable", value: formatNumber(summary.totalMiniWaveSpendable), icon: Wallet },
        { label: "Artist NanoWave earned", value: formatNumber(summary.totalArtistNanoEarned), icon: Music },
        { label: "Label NanoWave earned", value: formatNumber(summary.totalLabelNanoEarned), icon: Music },
        { label: "Total honors volume", value: formatNumber(summary.totalHonorsVolume), icon: Award },
        { label: "Users with balances", value: formatNumber(summary.totalUsersWithBalances), icon: Users },
        { label: "Eligible for on-chain settlement", value: "Yet to be added", icon: Zap },
      ]
    : Array.from({ length: 6 }, (_, i) => ({
        label: "",
        value: "",
        icon: [Coins, Wallet, Music, Award, Users, Zap][i],
      }))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon
        return (
          <Card key={i} className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Icon className="size-4" />
              </div>
              {loading ? (
                <div className="h-6 w-24 rounded bg-secondary animate-pulse mt-1" />
              ) : (
                <p className="text-lg font-semibold text-foreground font-mono tabular-nums">{c.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Mobile user detail sheet ─────────────────────────────────────────────────

function MobileDetailSheet({
  user,
  open,
  onOpenChange,
}: {
  user: MobileWalletRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  useEffect(() => {
    if (!user || !open) return
    setLedgerLoading(true)
    api
      .get<{ data: LedgerEntry[]; total: number }>(`/wallets/mobile/${user.userId}/ledger`, { limit: 50 })
      .then((res) => setLedger(res.data ?? []))
      .catch(() => setLedger([]))
      .finally(() => setLedgerLoading(false))
  }, [user, open])

  if (!user) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border shrink-0">
          <SheetTitle className="text-base">Wallet — {user.userName}</SheetTitle>
          <SheetDescription>User ID: {user.userId}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Profile</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-sm space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {user.userName}</p>
                {user.email && <p><span className="text-muted-foreground">Email:</span> {user.email}</p>}
                <p><span className="text-muted-foreground">Last updated:</span> {formatDateTime(user.updatedAt)}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Balances</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nano earned (total)</span>
                    <p className="font-mono font-medium">{formatNumber(user.nanoEarnedTotal)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mini balance</span>
                    <p className="font-mono font-medium">{formatNumber(user.miniBalance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Ledger entries</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 p-0">
                {ledgerLoading ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">Loading…</div>
                ) : ledger.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">No ledger entries yet.</div>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-xs whitespace-nowrap">Timestamp</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs text-right">Nano Δ</TableHead>
                          <TableHead className="text-xs text-right">Mini Δ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.map((e) => (
                          <TableRow key={e.id} className="border-border">
                            <TableCell className="text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                            <TableCell className="text-xs">{e.entry_type}</TableCell>
                            <TableCell className="text-xs">{e.source_type}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{e.description}</TableCell>
                            <TableCell className={cn("text-xs text-right font-mono", e.nano_delta >= 0 ? "text-foreground" : "text-destructive")}>
                              {e.nano_delta >= 0 ? "+" : ""}{e.nano_delta}
                            </TableCell>
                            <TableCell className={cn("text-xs text-right font-mono", (e.mini_delta ?? 0) >= 0 ? "text-foreground" : "text-destructive")}>
                              {(e.mini_delta ?? 0) >= 0 ? "+" : ""}{e.mini_delta ?? 0}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Artist detail sheet ──────────────────────────────────────────────────────

function ArtistDetailSheet({
  artist,
  open,
  onOpenChange,
}: {
  artist: ArtistWalletRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  useEffect(() => {
    if (!artist || !open) return
    setLedgerLoading(true)
    api
      .get<{ data: LedgerEntry[]; total: number }>(`/wallets/artist/${artist.artistId}/ledger`, { limit: 50 })
      .then((res) => setLedger(res.data ?? []))
      .catch(() => setLedger([]))
      .finally(() => setLedgerLoading(false))
  }, [artist, open])

  if (!artist) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border shrink-0">
          <SheetTitle className="text-base">Wallet — {artist.artistName}</SheetTitle>
          <SheetDescription>Artist ID: {artist.artistId}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Artist info</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-sm space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {artist.artistName}</p>
                {artist.handle && <p><span className="text-muted-foreground">Handle:</span> @{artist.handle}</p>}
                <p><span className="text-muted-foreground">Last updated:</span> {formatDateTime(artist.updatedAt)}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Balance</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Nano earned</span>
                  <p className="font-mono font-medium text-lg">{formatNumber(artist.nanoEarned)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Ledger entries</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 p-0">
                {ledgerLoading ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">Loading…</div>
                ) : ledger.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">No ledger entries yet.</div>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-xs whitespace-nowrap">Timestamp</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs text-right">Nano Δ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.map((e) => (
                          <TableRow key={e.id} className="border-border">
                            <TableCell className="text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                            <TableCell className="text-xs">{e.entry_type}</TableCell>
                            <TableCell className="text-xs">{e.source_type}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{e.description}</TableCell>
                            <TableCell className={cn("text-xs text-right font-mono", e.nano_delta >= 0 ? "text-foreground" : "text-destructive")}>
                              {e.nano_delta >= 0 ? "+" : ""}{e.nano_delta}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Emission rate card ───────────────────────────────────────────────────────

function EmissionRateCard() {
  // Live values, loaded once on mount from the backend. The backend reads
  // from app_settings.listening_emission and is the same source the
  // mobile app's credit_listening_progress / credit_listening_play RPCs
  // pull from. Ad emission is NOT configured here — those are managed
  // per-ad in the Ads section.
  const [nanoPerWindow, setNanoPerWindow] = useState<number>(1)
  const [windowSeconds, setWindowSeconds] = useState<number>(10)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<{ nano_per_window: number; window_seconds: number }>(
          "/wallets/emission-rate",
        )
        setNanoPerWindow(Number(r.nano_per_window))
        setWindowSeconds(Number(r.window_seconds))
      } catch (err: any) {
        toast.error(`Failed to load emission rate: ${err.message ?? err}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    const n = Math.floor(Number(nanoPerWindow))
    const w = Math.floor(Number(windowSeconds))
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Nano amount must be a non-negative whole number")
      return
    }
    if (!Number.isFinite(w) || w <= 0) {
      toast.error("Seconds must be a positive whole number")
      return
    }
    setSaving(true)
    try {
      await api.post("/wallets/emission-rate", {
        nano_per_window: n,
        window_seconds: w,
      })
      setNanoPerWindow(n)
      setWindowSeconds(w)
      toast.success(`Emission rate updated: ${n} Nano per ${w}s`)
    } catch (err: any) {
      toast.error(`Update failed: ${err.message ?? err}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm">Emission rate</CardTitle>
        </div>
        <CardDescription>
          Nano credited to listeners for every qualifying stream. The mobile
          app reads this live — ad rewards are configured per-ad in the Ads
          section.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emission-nano" className="text-xs">Nano per window</Label>
            <Input
              id="emission-nano"
              type="number"
              min={0}
              step={1}
              disabled={loading}
              className="h-8 font-mono text-sm max-w-[140px]"
              value={nanoPerWindow}
              onChange={(e) => setNanoPerWindow(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emission-seconds" className="text-xs">Window length (seconds)</Label>
            <Input
              id="emission-seconds"
              type="number"
              min={1}
              step={1}
              disabled={loading}
              className="h-8 font-mono text-sm max-w-[140px]"
              value={windowSeconds}
              onChange={(e) => setWindowSeconds(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Currently:{" "}
          <span className="font-mono text-foreground">
            {nanoPerWindow} Nano every {windowSeconds}s
          </span>
          {windowSeconds > 0 && (
            <>
              {" "}
              ({((nanoPerWindow / windowSeconds) * 60).toFixed(1)} Nano/minute)
            </>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Saving…" : "Update emission rate"}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

type WalletView = "mobile" | "artist" | "label"

export default function WalletsPage() {
  const [view, setView] = useState<WalletView>("mobile")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  // Summary
  const [summary, setSummary] = useState<PlatformSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Mobile wallets
  const [mobileWallets, setMobileWallets] = useState<MobileWalletRow[]>([])
  const [mobileTotal, setMobileTotal] = useState(0)
  const [mobileLoading, setMobileLoading] = useState(false)

  // Artist wallets
  const [artistWallets, setArtistWallets] = useState<ArtistWalletRow[]>([])
  const [artistTotal, setArtistTotal] = useState(0)
  const [artistLoading, setArtistLoading] = useState(false)

  // Label wallets — populated when honor_artist routes a fan's honor to a
  // catalog-only artist's label (artists.profile_id IS NULL + roster lookup).
  const [labelWallets, setLabelWallets] = useState<LabelWalletRow[]>([])
  const [labelTotal, setLabelTotal] = useState(0)
  const [labelLoading, setLabelLoading] = useState(false)

  // Detail sheets
  const [selectedMobileUser, setSelectedMobileUser] = useState<MobileWalletRow | null>(null)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [selectedArtist, setSelectedArtist] = useState<ArtistWalletRow | null>(null)
  const [artistDetailOpen, setArtistDetailOpen] = useState(false)

  // Load summary
  useEffect(() => {
    setSummaryLoading(true)
    api
      .get<PlatformSummary>("/wallets/summary")
      .then((res) => setSummary(res))
      .catch((e) => toast.error(e.message ?? "Failed to load summary"))
      .finally(() => setSummaryLoading(false))
  }, [])

  // Load mobile wallets
  const loadMobile = useCallback(async () => {
    setMobileLoading(true)
    try {
      const res = await api.get<{ data: MobileWalletRow[]; total: number }>("/wallets/mobile", {
        search: search || undefined,
        limit: 200,
        offset: 0,
      })
      setMobileWallets(res.data ?? [])
      setMobileTotal(res.total ?? 0)
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load mobile wallets")
    }
    setMobileLoading(false)
  }, [search])

  // Load artist wallets
  const loadArtist = useCallback(async () => {
    setArtistLoading(true)
    try {
      const res = await api.get<{ data: ArtistWalletRow[]; total: number }>("/wallets/artist", {
        search: search || undefined,
        limit: 200,
        offset: 0,
      })
      setArtistWallets(res.data ?? [])
      setArtistTotal(res.total ?? 0)
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load artist wallets")
    }
    setArtistLoading(false)
  }, [search])

  // Load label wallets
  const loadLabel = useCallback(async () => {
    setLabelLoading(true)
    try {
      const res = await api.get<{ data: LabelWalletRow[]; total: number }>("/wallets/labels", {
        search: search || undefined,
        limit: 200,
        offset: 0,
      })
      setLabelWallets(res.data ?? [])
      setLabelTotal(res.total ?? 0)
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load label wallets")
    }
    setLabelLoading(false)
  }, [search])

  useEffect(() => {
    if (view === "mobile") loadMobile()
    else if (view === "artist") loadArtist()
    else loadLabel()
  }, [view, loadMobile, loadArtist, loadLabel])

  // Pagination
  const currentList =
    view === "mobile" ? mobileWallets : view === "artist" ? artistWallets : labelWallets
  const totalPages = Math.ceil(currentList.length / PAGE_SIZE)
  const pageItems = currentList.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const loading =
    view === "mobile" ? mobileLoading : view === "artist" ? artistLoading : labelLoading

  const openMobileDetail = (user: MobileWalletRow) => {
    setSelectedMobileUser(user)
    setMobileDetailOpen(true)
  }

  const openArtistDetail = (artist: ArtistWalletRow) => {
    setSelectedArtist(artist)
    setArtistDetailOpen(true)
  }

  return (
    <div>
      <AdminTopbar title="Wallets & Ledger" subtitle="Inspect user rewards, conversion, spendable balance, and on-chain eligibility" />
      <div className="p-6 max-w-[1600px] space-y-6">
        <SummaryCards summary={summary} loading={summaryLoading} />

        <EmissionRateCard />

        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">
                  {view === "mobile"
                    ? "Mobile user wallets"
                    : view === "artist"
                      ? "Artist wallets"
                      : "Label wallets"}
                </CardTitle>
                <CardDescription>Click a row to open wallet detail and ledger</CardDescription>
              </div>
              <Select value={view} onValueChange={(v) => { setView(v as WalletView); setPage(0); setSearch("") }}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">Mobile users</SelectItem>
                  <SelectItem value="artist">Artists</SelectItem>
                  <SelectItem value="label">Labels</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder={
                    view === "mobile"
                      ? "Search by name, email, user ID…"
                      : view === "artist"
                        ? "Search by name, handle, artist ID…"
                        : "Search by label name or ID…"
                  }
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-md border border-border">
              {view === "label" ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-secondary/30">
                      <TableHead className="text-xs font-semibold text-muted-foreground">Label</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Legal entity</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Label ID</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground text-right">Nano earned</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Last updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-border">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <TableCell key={j}><div className="h-4 rounded bg-secondary animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (pageItems as LabelWalletRow[]).length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                          No label wallets yet. Honors routed to labels (for catalog-only artists) will show up here.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (pageItems as LabelWalletRow[]).map((l) => (
                        <TableRow key={l.labelProfileId} className="border-border hover:bg-secondary/20">
                          <TableCell className="text-xs font-medium">{l.labelName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.legalEntityName || "—"}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">{l.labelProfileId}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatNumber(l.nanoEarned)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(l.updatedAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : view === "mobile" ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-secondary/30">
                      <TableHead className="text-xs font-semibold text-muted-foreground">User</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Email</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">User ID</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground text-right">Nano earned</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground text-right">Mini balance</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Last updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-border">
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><div className="h-4 rounded bg-secondary animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (pageItems as MobileWalletRow[]).length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                          No mobile wallets found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (pageItems as MobileWalletRow[]).map((u) => (
                        <TableRow
                          key={u.userId}
                          className="border-border hover:bg-secondary/20 cursor-pointer"
                          onClick={() => openMobileDetail(u)}
                        >
                          <TableCell className="text-xs font-medium">{u.userName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{u.email || "—"}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">{u.userId}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatNumber(u.nanoEarnedTotal)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatNumber(u.miniBalance)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(u.updatedAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-secondary/30">
                      <TableHead className="text-xs font-semibold text-muted-foreground">Artist</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Handle</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Artist ID</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground text-right">Nano earned</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground">Last updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-border">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <TableCell key={j}><div className="h-4 rounded bg-secondary animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (pageItems as ArtistWalletRow[]).length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                          No artist wallets found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (pageItems as ArtistWalletRow[]).map((a) => (
                        <TableRow
                          key={a.artistId}
                          className="border-border hover:bg-secondary/20 cursor-pointer"
                          onClick={() => openArtistDetail(a)}
                        >
                          <TableCell className="text-xs font-medium">{a.artistName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.handle ? `@${a.handle}` : "—"}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">{a.artistId}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatNumber(a.nanoEarned)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(a.updatedAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, currentList.length)} of {currentList.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">Page {page + 1} of {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileDetailSheet user={selectedMobileUser} open={mobileDetailOpen} onOpenChange={setMobileDetailOpen} />
      <ArtistDetailSheet artist={selectedArtist} open={artistDetailOpen} onOpenChange={setArtistDetailOpen} />
    </div>
  )
}
