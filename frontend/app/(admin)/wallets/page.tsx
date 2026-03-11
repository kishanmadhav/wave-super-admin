"use client"

import { useState, useMemo } from "react"
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
  TrendingUp,
  Lock,
  Award,
  Users,
  Zap,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Gauge,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"

// ─── Mock data types (structure for future API) ─────────────────────────────

export type WalletStatus = "active" | "locked" | "flagged" | "pending_kyc"
export type LedgerEntryType =
  | "song_listening"
  | "ad_listening"
  | "honors"
  | "referral"
  | "campaign"
  | "manual_adjustment"
  | "conversion"
  | "spend"
  | "reversal"
  | "on_chain_settlement"

export interface PlatformWalletSummary {
  totalNanoWaveIssued: number
  totalMiniWaveConverted: number
  totalMiniWaveSpendable: number
  totalCoinsPendingFinalization: number
  totalCoinsEligibleOnChain: number
  totalOnChainSettled: number
  totalHonorsVolume: number
  totalUsersWithBalances: number
}

export interface UserWalletRow {
  userId: string
  userName: string
  walletStatus: WalletStatus
  nanoWaveEarned: number
  nanoWavePending: number
  nanoWaveFinalized: number
  nanoWaveAutoConverted: number
  miniWaveSpendable: number
  miniWaveLocked: number
  miniWaveSpent: number
  eligibleOnChain: boolean
  settledOnChain: number
  honorsGiven: number
  honorsReceived: number
  lastActivity: string
  riskFlagged: boolean
  walletAddress?: string
}

export interface LedgerEntryRow {
  id: string
  timestamp: string
  entryType: LedgerEntryType
  sourceType: string
  sourceRefId: string | null
  description: string
  nanoWaveDelta: number
  miniWaveDelta: number
  runningBalanceNano?: number
  runningBalanceMini?: number
  status: "pending" | "settled" | "reversed"
  onChainStatus: "none" | "eligible" | "submitted" | "confirmed"
  txHash: string | null
}

export interface SourceBreakdown {
  source: string
  nanoEarned: number
  miniEarned: number
  count: number
}

// ─── Mock data ─────────────────────────────────────────────────────────────

const MOCK_PLATFORM_SUMMARY: PlatformWalletSummary = {
  totalNanoWaveIssued: 2_847_320,
  totalMiniWaveConverted: 1_204_560,
  totalMiniWaveSpendable: 892_100,
  totalCoinsPendingFinalization: 156_400,
  totalCoinsEligibleOnChain: 412_800,
  totalOnChainSettled: 1_891_200,
  totalHonorsVolume: 48_920,
  totalUsersWithBalances: 12_440,
}

const WALLET_STATUS_LABEL: Record<WalletStatus, string> = {
  active: "Active",
  locked: "Locked",
  flagged: "Flagged",
  pending_kyc: "Pending KYC",
}

const ENTRY_TYPE_LABEL: Record<LedgerEntryType, string> = {
  song_listening: "Song listening",
  ad_listening: "Ad listening",
  honors: "Honors",
  referral: "Referral",
  campaign: "Campaign / task",
  manual_adjustment: "Manual adjustment",
  conversion: "Conversion",
  spend: "Spend",
  reversal: "Reversal",
  on_chain_settlement: "On-chain settlement",
}

function genId() {
  return Math.random().toString(36).slice(2, 11)
}

const MOCK_USER_WALLETS: UserWalletRow[] = Array.from({ length: 24 }, (_, i) => {
  const nanoEarned = 800 + i * 420 + Math.floor(Math.random() * 300)
  const pending = Math.floor(nanoEarned * (0.05 + Math.random() * 0.15))
  const finalized = nanoEarned - pending
  const converted = Math.floor(finalized * (0.3 + Math.random() * 0.4))
  const spendable = Math.floor(converted * 0.7)
  const locked = converted - spendable
  const spent = Math.floor(spendable * (0.1 + Math.random() * 0.5))
  const onChain = Math.floor(spendable * 0.2)
  return {
    userId: `usr-${1000 + i}`,
    userName: ["Alex Rivera", "Jordan Lee", "Sam Chen", "Casey Morgan", "Riley Kim", "Quinn Davis", "Avery Brown", "Taylor Green", "Morgan White", "Jamie Fox", "Drew Hall", "Blake Stone", "Skyler Reed", "Cameron Bell", "Parker Ward", "Reese Scott", "Dakota Gray", "Finley Brooks", "Emery Hayes", "Sage Cooper", "Rowan King", "Phoenix Wright", "River Adams", "Indigo Clark"][i % 24],
    walletStatus: i % 10 === 0 ? "flagged" : i % 15 === 1 ? "locked" : i % 20 === 2 ? "pending_kyc" : "active",
    nanoWaveEarned: nanoEarned,
    nanoWavePending: pending,
    nanoWaveFinalized: finalized,
    nanoWaveAutoConverted: converted,
    miniWaveSpendable: spendable - spent,
    miniWaveLocked: locked,
    miniWaveSpent: spent,
    eligibleOnChain: spendable - spent >= 100 && i % 3 !== 0,
    settledOnChain: onChain,
    honorsGiven: Math.floor(Math.random() * 80),
    honorsReceived: Math.floor(Math.random() * 120),
    lastActivity: new Date(Date.now() - i * 3600000 * 12).toISOString(),
    riskFlagged: i % 10 === 0,
    walletAddress: i % 4 === 0 ? `0x${genId()}${genId()}` : undefined,
  }
})

function mockLedgerForUser(userId: string): LedgerEntryRow[] {
  const entries: LedgerEntryRow[] = []
  const types: LedgerEntryType[] = ["song_listening", "ad_listening", "honors", "referral", "campaign", "conversion", "spend", "manual_adjustment", "reversal", "on_chain_settlement"]
  let runNano = 0
  let runMini = 0
  for (let i = 0; i < 18; i++) {
    const type = types[i % types.length]
    const nano = type === "spend" || type === "reversal" ? (i % 3 === 0 ? -20 : 0) : type === "conversion" ? -50 : type === "on_chain_settlement" ? 0 : 15 + Math.floor(Math.random() * 40)
    const mini = type === "conversion" ? 5 : type === "spend" ? (i % 4 === 0 ? -2 : 0) : type === "honors" ? 1 + Math.floor(Math.random() * 3) : 0
    runNano += nano
    runMini += mini
    entries.push({
      id: `ledger-${userId}-${i}`,
      timestamp: new Date(Date.now() - i * 86400000 * 2).toISOString(),
      entryType: type,
      sourceType: type.replace(/_/g, " "),
      sourceRefId: type === "song_listening" ? `track-${100 + i}` : type === "honors" ? `hon-${200 + i}` : null,
      description: `${ENTRY_TYPE_LABEL[type]}${type === "song_listening" ? " — Track play" : ""}`,
      nanoWaveDelta: nano,
      miniWaveDelta: mini,
      runningBalanceNano: runNano,
      runningBalanceMini: runMini,
      status: i < 2 ? "pending" : "settled",
      onChainStatus: type === "on_chain_settlement" ? "confirmed" : runMini > 50 ? "eligible" : "none",
      txHash: type === "on_chain_settlement" ? `0x${genId()}${genId()}${genId()}` : null,
    })
  }
  return entries.reverse()
}

function mockSourceBreakdown(userId: string): SourceBreakdown[] {
  return [
    { source: "Song listening", nanoEarned: 1240, miniEarned: 0, count: 89 },
    { source: "Ad listening", nanoEarned: 320, miniEarned: 0, count: 24 },
    { source: "Honors", nanoEarned: 0, miniEarned: 180, count: 45 },
    { source: "Campaign / task", nanoEarned: 150, miniEarned: 0, count: 6 },
    { source: "Referral", nanoEarned: 80, miniEarned: 0, count: 2 },
    { source: "Manual adjustment", nanoEarned: 0, miniEarned: 20, count: 1 },
  ]
}

// ─── Summary cards ─────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: PlatformWalletSummary }) {
  const cards: { label: string; value: string | number; icon: React.ElementType }[] = [
    { label: "Total NanoWave issued", value: formatNumber(summary.totalNanoWaveIssued), icon: Coins },
    { label: "Total MiniWave converted", value: formatNumber(summary.totalMiniWaveConverted), icon: Zap },
    { label: "Total MiniWave spendable", value: formatNumber(summary.totalMiniWaveSpendable), icon: Wallet },
    { label: "Coins pending finalization", value: formatNumber(summary.totalCoinsPendingFinalization), icon: TrendingUp },
    { label: "Eligible for on-chain settlement", value: formatNumber(summary.totalCoinsEligibleOnChain), icon: CheckCircle2 },
    { label: "On-chain settled amount", value: formatNumber(summary.totalOnChainSettled), icon: CheckCircle2 },
    { label: "Total honors volume", value: formatNumber(summary.totalHonorsVolume), icon: Award },
    { label: "Users with balances", value: formatNumber(summary.totalUsersWithBalances), icon: Users },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card key={c.label} className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Icon className="size-4" />
              </div>
              <p className="text-lg font-semibold text-foreground font-mono tabular-nums">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── User detail sheet ─────────────────────────────────────────────────────

interface UserDetailSheetProps {
  user: UserWalletRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function UserDetailSheet({ user, open, onOpenChange }: UserDetailSheetProps) {
  const ledger = user ? mockLedgerForUser(user.userId) : []
  const sourceBreakdown = user ? mockSourceBreakdown(user.userId) : []

  if (!user) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border shrink-0">
          <SheetTitle className="text-base">Wallet & Ledger — {user.userName}</SheetTitle>
          <SheetDescription>User ID: {user.userId}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Profile summary */}
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Profile summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-sm space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {user.userName}</p>
                <p><span className="text-muted-foreground">Wallet status:</span> <Badge variant={user.walletStatus === "active" ? "default" : "secondary"} className="text-xs">{WALLET_STATUS_LABEL[user.walletStatus]}</Badge></p>
                {user.walletAddress && <p><span className="text-muted-foreground">Wallet address:</span> <code className="text-xs font-mono break-all">{user.walletAddress}</code></p>}
                <p><span className="text-muted-foreground">Last activity:</span> {formatDateTime(user.lastActivity)}</p>
              </CardContent>
            </Card>

            {/* Current balances */}
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Current balances by type</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">NanoWave earned</span><p className="font-mono font-medium">{user.nanoWaveEarned}</p></div>
                  <div><span className="text-muted-foreground">NanoWave pending</span><p className="font-mono font-medium">{user.nanoWavePending}</p></div>
                  <div><span className="text-muted-foreground">NanoWave finalized</span><p className="font-mono font-medium">{user.nanoWaveFinalized}</p></div>
                  <div><span className="text-muted-foreground">NanoWave auto-converted</span><p className="font-mono font-medium">{user.nanoWaveAutoConverted}</p></div>
                  <div><span className="text-muted-foreground">MiniWave spendable</span><p className="font-mono font-medium">{user.miniWaveSpendable}</p></div>
                  <div><span className="text-muted-foreground">MiniWave locked</span><p className="font-mono font-medium">{user.miniWaveLocked}</p></div>
                  <div><span className="text-muted-foreground">MiniWave spent</span><p className="font-mono font-medium">{user.miniWaveSpent}</p></div>
                  <div><span className="text-muted-foreground">Eligible for on-chain</span><p className="font-mono font-medium">{user.eligibleOnChain ? "Yes" : "No"}</p></div>
                  <div><span className="text-muted-foreground">Already settled on-chain</span><p className="font-mono font-medium">{user.settledOnChain}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Conversion & settlement summary */}
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Conversion & on-chain settlement summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-sm space-y-1">
                <p>Total converted to MiniWave: <strong>{user.nanoWaveAutoConverted}</strong></p>
                <p>Total eligible for chain: <strong>{user.eligibleOnChain ? (user.miniWaveSpendable + user.settledOnChain) : 0}</strong></p>
                <p>Total settled on-chain: <strong>{user.settledOnChain}</strong></p>
              </CardContent>
            </Card>

            {/* Source breakdown */}
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Source-wise earnings breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs">Source</TableHead>
                      <TableHead className="text-xs text-right">Nano</TableHead>
                      <TableHead className="text-xs text-right">Mini</TableHead>
                      <TableHead className="text-xs text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceBreakdown.map((s) => (
                      <TableRow key={s.source} className="border-border">
                        <TableCell className="text-xs">{s.source}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{s.nanoEarned}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{s.miniEarned}</TableCell>
                        <TableCell className="text-xs text-right">{s.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Honors summary */}
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Honors summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-sm">
                <p>Honors given: <strong>{user.honorsGiven}</strong></p>
                <p>Honors received: <strong>{user.honorsReceived}</strong></p>
              </CardContent>
            </Card>

            {/* Recent ledger entries */}
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Recent ledger entries</CardTitle>
                <CardDescription>Timestamp, type, source, deltas, status</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 p-0">
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs whitespace-nowrap">Timestamp</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Source</TableHead>
                        <TableHead className="text-xs text-right">Nano Δ</TableHead>
                        <TableHead className="text-xs text-right">Mini Δ</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">On-chain</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.map((e) => (
                        <TableRow key={e.id} className="border-border">
                          <TableCell className="text-xs whitespace-nowrap">{formatDateTime(e.timestamp)}</TableCell>
                          <TableCell className="text-xs">{ENTRY_TYPE_LABEL[e.entryType]}</TableCell>
                          <TableCell className="text-xs">{e.sourceType}</TableCell>
                          <TableCell className={cn("text-xs text-right font-mono", e.nanoWaveDelta >= 0 ? "text-foreground" : "text-destructive")}>{e.nanoWaveDelta >= 0 ? "+" : ""}{e.nanoWaveDelta}</TableCell>
                          <TableCell className={cn("text-xs text-right font-mono", e.miniWaveDelta >= 0 ? "text-foreground" : "text-destructive")}>{e.miniWaveDelta >= 0 ? "+" : ""}{e.miniWaveDelta}</TableCell>
                          <TableCell className="text-xs"><Badge variant={e.status === "settled" ? "secondary" : "outline"} className="text-[10px]">{e.status}</Badge></TableCell>
                          <TableCell className="text-xs">{e.onChainStatus}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Emission rate (hardcoded) ─────────────────────────────────────────────

const DEFAULT_EMISSION_RATE_STREAM = 0.05
const DEFAULT_EMISSION_RATE_AD = 0.02

function EmissionRateCard() {
  const [streamRate, setStreamRate] = useState(DEFAULT_EMISSION_RATE_STREAM)
  const [adRate, setAdRate] = useState(DEFAULT_EMISSION_RATE_AD)
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success("Emission rates updated (demo — not persisted)")
    }, 400)
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm">Emission rate</CardTitle>
        </div>
        <CardDescription>NanoWave issued per qualified stream or ad listen. Values are for display only; backend not connected.</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emission-stream" className="text-xs">Per qualified stream (NanoWave)</Label>
            <Input
              id="emission-stream"
              type="number"
              min={0}
              max={1}
              step={0.01}
              className="h-8 font-mono text-sm max-w-[140px]"
              value={streamRate}
              onChange={(e) => setStreamRate(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emission-ad" className="text-xs">Per ad listen (NanoWave)</Label>
            <Input
              id="emission-ad"
              type="number"
              min={0}
              max={1}
              step={0.01}
              className="h-8 font-mono text-sm max-w-[140px]"
              value={adRate}
              onChange={(e) => setAdRate(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Update emission rate"}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

export default function WalletsPage() {
  const [search, setSearch] = useState("")
  const [walletStateFilter, setWalletStateFilter] = useState<string>("all")
  const [flaggedFilter, setFlaggedFilter] = useState<string>("all")
  const [claimableFilter, setClaimableFilter] = useState<string>("all")
  const [onChainFilter, setOnChainFilter] = useState<string>("all")
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all")
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all")
  const [page, setPage] = useState(0)
  const [selectedUser, setSelectedUser] = useState<UserWalletRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loading] = useState(false)

  const summary = MOCK_PLATFORM_SUMMARY
  const filtered = useMemo(() => {
    let list = [...MOCK_USER_WALLETS]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) =>
          u.userName.toLowerCase().includes(q) ||
          u.userId.toLowerCase().includes(q) ||
          (u.walletAddress && u.walletAddress.toLowerCase().includes(q))
      )
    }
    if (walletStateFilter !== "all") list = list.filter((u) => u.walletStatus === walletStateFilter)
    if (flaggedFilter === "flagged") list = list.filter((u) => u.riskFlagged)
    if (flaggedFilter === "clean") list = list.filter((u) => !u.riskFlagged)
    if (claimableFilter === "yes") list = list.filter((u) => u.miniWaveSpendable > 0)
    if (onChainFilter === "eligible") list = list.filter((u) => u.eligibleOnChain)
    return list
  }, [search, walletStateFilter, flaggedFilter, claimableFilter, onChainFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageUsers = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const openDetail = (user: UserWalletRow) => {
    setSelectedUser(user)
    setDetailOpen(true)
  }

  return (
    <div>
      <AdminTopbar title="Wallets & Ledger" subtitle="Inspect user rewards, conversion, spendable balance, and on-chain eligibility" />
      <div className="p-6 max-w-[1600px] space-y-6">
        <SummaryCards summary={summary} />

        <EmissionRateCard />

        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">User wallets</CardTitle>
            <CardDescription>Click a row to open wallet detail and ledger</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* Filters and search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, user ID, wallet address…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                />
              </div>
              <Select value={walletStateFilter} onValueChange={(v) => { setWalletStateFilter(v); setPage(0) }}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Wallet state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {(["active", "locked", "flagged", "pending_kyc"] as const).map((s) => (
                    <SelectItem key={s} value={s}>{WALLET_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={flaggedFilter} onValueChange={(v) => { setFlaggedFilter(v); setPage(0) }}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Flagged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="clean">Not flagged</SelectItem>
                </SelectContent>
              </Select>
              <Select value={claimableFilter} onValueChange={(v) => { setClaimableFilter(v); setPage(0) }}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Claimable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Has claimable balance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={onChainFilter} onValueChange={(v) => { setOnChainFilter(v); setPage(0) }}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="On-chain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="eligible">On-chain eligible</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Source type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="listening">Listening</SelectItem>
                  <SelectItem value="honors">Honors</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="campaign">Campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-secondary/30">
                    <TableHead className="text-xs font-semibold text-muted-foreground">User name</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">User ID</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Wallet status</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Nano earned</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Nano pending</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Nano finalized</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Auto-converted</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Mini spendable</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Mini locked</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Mini spent</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">On-chain eligible</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Settled on-chain</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Honors given</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Honors received</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Last activity</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-border">
                        {Array.from({ length: 17 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 rounded bg-secondary animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : pageUsers.length === 0 ? (
                    <TableRow className="border-border">
                      <TableCell colSpan={17} className="text-center py-8 text-muted-foreground text-sm">
                        No users match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageUsers.map((u) => (
                      <TableRow
                        key={u.userId}
                        className="border-border hover:bg-secondary/20 cursor-pointer"
                        onClick={() => openDetail(u)}
                      >
                        <TableCell className="text-xs font-medium">{u.userName}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{u.userId}</TableCell>
                        <TableCell><Badge variant={u.walletStatus === "active" ? "default" : "secondary"} className="text-[10px]">{WALLET_STATUS_LABEL[u.walletStatus]}</Badge></TableCell>
                        <TableCell className="text-xs text-right font-mono">{formatNumber(u.nanoWaveEarned)}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{u.nanoWavePending}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{u.nanoWaveFinalized}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{u.nanoWaveAutoConverted}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{u.miniWaveSpendable}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{u.miniWaveLocked}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{u.miniWaveSpent}</TableCell>
                        <TableCell className="text-xs">{u.eligibleOnChain ? "Yes" : "No"}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{u.settledOnChain}</TableCell>
                        <TableCell className="text-xs text-right">{u.honorsGiven}</TableCell>
                        <TableCell className="text-xs text-right">{u.honorsReceived}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(u.lastActivity)}</TableCell>
                        <TableCell>{u.riskFlagged ? <AlertTriangle className="size-4 text-destructive" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
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

      <UserDetailSheet user={selectedUser} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  )
}
