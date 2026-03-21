"use client"

import { useState, useEffect, useCallback } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, formatNumber } from "@/lib/utils"
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Ban,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Mail,
  Phone,
  Calendar,
  User,
  Music,
  Globe,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MobileUser {
  id: string
  email: string | null
  phone: string | null
  username: string | null
  profile_photo_url: string | null
  taste_genres: string[]
  taste_languages: string[]
  onboarding_completed: boolean
  onboarding_step: number
  created_at: string
  updated_at: string
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function UserDetailSheet({
  user,
  open,
  onOpenChange,
  onSuspend,
  onUnsuspend,
  onDelete,
}: {
  user: MobileUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuspend: (id: string, reason: string) => void
  onUnsuspend: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (!user) return null

  const displayName = user.username?.trim() || (user.email ? user.email.split("@")[0] : user.id.slice(0, 8))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border shrink-0">
          <SheetTitle className="text-base">{displayName}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{user.id}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Profile info */}
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Profile</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <User className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Username:</span>
                  <span>{user.username || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Email:</span>
                  <span>{user.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span>{user.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Joined:</span>
                  <span>{formatDateTime(user.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Onboarding:</span>
                  <Badge variant={user.onboarding_completed ? "default" : "secondary"} className="text-[10px]">
                    {user.onboarding_completed ? "Completed" : `Step ${user.onboarding_step}`}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Taste */}
            {(user.taste_genres?.length > 0 || user.taste_languages?.length > 0) && (
              <Card className="border-border bg-card">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Music taste</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 text-sm space-y-3">
                  {user.taste_genres?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Music className="size-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">Genres</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {user.taste_genres.map((g) => (
                          <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {user.taste_languages?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className="size-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">Languages</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {user.taste_languages.map((l) => (
                          <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card className="border-border bg-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => onSuspend(user.id, "")}
                >
                  <ShieldOff className="size-3.5" />
                  Suspend account
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => onUnsuspend(user.id)}
                >
                  <ShieldCheck className="size-3.5" />
                  Unsuspend account
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => onDelete(user.id)}
                >
                  <Trash2 className="size-3.5" />
                  Permanently delete account
                </Button>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

export default function UsersPage() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [users, setUsers] = useState<MobileUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Detail sheet
  const [selectedUser, setSelectedUser] = useState<MobileUser | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Suspend dialog
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState("")

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: MobileUser[]; total: number }>("/users/mobile", {
        search: search || undefined,
        limit: 200,
        offset: 0,
      })
      setUsers(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load users")
    }
    setLoading(false)
  }, [search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const totalPages = Math.ceil(users.length / PAGE_SIZE)
  const pageUsers = users.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const openDetail = (user: MobileUser) => {
    setSelectedUser(user)
    setDetailOpen(true)
  }

  // Suspend
  const handleSuspendClick = (id: string) => {
    setSuspendTarget(id)
    setSuspendReason("")
    setDetailOpen(false)
  }

  const confirmSuspend = async () => {
    if (!suspendTarget) return
    try {
      await api.post(`/users/mobile/${suspendTarget}/suspend`, { reason: suspendReason || "Suspended by admin" })
      toast.success("User suspended")
      setSuspendTarget(null)
      loadUsers()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to suspend user")
    }
  }

  // Unsuspend
  const handleUnsuspend = async (id: string) => {
    try {
      await api.post(`/users/mobile/${id}/unsuspend`)
      toast.success("User unsuspended")
      setDetailOpen(false)
      loadUsers()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to unsuspend user")
    }
  }

  // Delete
  const handleDeleteClick = (id: string) => {
    setDeleteTarget(id)
    setDetailOpen(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/users/mobile/${deleteTarget}`)
      toast.success("User permanently deleted")
      setDeleteTarget(null)
      loadUsers()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete user")
    }
  }

  const getDisplayName = (u: MobileUser) =>
    u.username?.trim() || (u.email ? u.email.split("@")[0] : u.id.slice(0, 8))

  return (
    <div>
      <AdminTopbar title="Mobile Users" subtitle="Manage mobile app users — view, suspend, or delete accounts" />
      <div className="p-6 max-w-[1400px] space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="size-4" />
              </div>
              <p className="text-lg font-semibold text-foreground font-mono tabular-nums">{formatNumber(total)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total mobile users</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ShieldCheck className="size-4" />
              </div>
              <p className="text-lg font-semibold text-foreground font-mono tabular-nums">
                {formatNumber(users.filter((u) => u.onboarding_completed).length)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Onboarding completed</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Mail className="size-4" />
              </div>
              <p className="text-lg font-semibold text-foreground font-mono tabular-nums">
                {formatNumber(users.filter((u) => u.email).length)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">With email</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Phone className="size-4" />
              </div>
              <p className="text-lg font-semibold text-foreground font-mono tabular-nums">
                {formatNumber(users.filter((u) => u.phone).length)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">With phone</p>
            </CardContent>
          </Card>
        </div>

        {/* User table */}
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">All mobile users</CardTitle>
            <CardDescription>Click a row to view details or manage the account</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-secondary/30">
                    <TableHead className="text-xs font-semibold text-muted-foreground">User</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Genres</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Onboarding</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">Joined</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-border">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 rounded bg-secondary animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : pageUsers.length === 0 ? (
                    <TableRow className="border-border">
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                        No mobile users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageUsers.map((u) => (
                      <TableRow
                        key={u.id}
                        className="border-border hover:bg-secondary/20 cursor-pointer"
                        onClick={() => openDetail(u)}
                      >
                        <TableCell className="text-xs font-medium">{getDisplayName(u)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.email || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                          {u.taste_genres?.length > 0 ? u.taste_genres.slice(0, 3).join(", ") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.onboarding_completed ? "default" : "secondary"} className="text-[10px]">
                            {u.onboarding_completed ? "Done" : `Step ${u.onboarding_step}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(u.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Suspend"
                              onClick={() => handleSuspendClick(u.id)}
                            >
                              <Ban className="size-3.5 text-yellow-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Delete"
                              onClick={() => handleDeleteClick(u.id)}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
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
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, users.length)} of {users.length}
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

      {/* Detail sheet */}
      <UserDetailSheet
        user={selectedUser}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSuspend={handleSuspendClick}
        onUnsuspend={handleUnsuspend}
        onDelete={handleDeleteClick}
      />

      {/* Suspend confirmation dialog */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend user</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable the user&apos;s login. They won&apos;t be able to access the app until unsuspended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for suspension (optional)"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSuspend}>Suspend</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete user</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user&apos;s account and all associated data (wallet, tribe memberships, etc.). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
