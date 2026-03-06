"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabase"
import { formatDateTime, initials, truncate } from "@/lib/utils"
import { Search, Download, ShieldCheck, ShieldOff, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface Artist {
  id: string; name: string; handle: string; location: string | null
  followers: number; created_at: string
}
interface LabelProfile {
  id: string; label_name: string | null; legal_entity_name: string | null
  registered_country: string | null; created_at: string
}

function CreatorsTable({ artists, loading }: { artists: Artist[], loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Artist</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Handle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Followers</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Joined</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                ))}</tr>
              )) : artists.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No artists found</td></tr>
              ) : artists.map(a => (
                <tr key={a.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(a.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{truncate(a.name, 28)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">@{a.handle}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{a.location ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{a.followers.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info("Verify — coming soon")}><ShieldCheck className="mr-2 size-4" />Verify</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Unverify — coming soon")}><ShieldOff className="mr-2 size-4" />Unverify</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => toast.info("Takedown — coming soon")}>Emergency Takedown</DropdownMenuItem>
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
  )
}

export default function CreatorsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [labels, setLabels] = useState<LabelProfile[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [artistsRes, labelsRes] = await Promise.all([
        supabase.from("artists").select("id,name,handle,location,followers,created_at")
          .ilike("name", `%${search}%`).order("created_at", { ascending: false }).limit(50),
        supabase.from("label_profiles").select("id,label_name,legal_entity_name,registered_country,created_at")
          .order("created_at", { ascending: false }).limit(50),
      ])
      setArtists(artistsRes.data ?? [])
      setLabels(labelsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [search])

  return (
    <div>
      <AdminTopbar title="Creators" subtitle="Individuals, Bands & Labels" />
      <div className="p-6 max-w-[1400px] space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input placeholder="Search by name…" className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="size-3.5" />Export</Button>
          </div>
        </div>

        <Tabs defaultValue="individuals">
          <TabsList>
            <TabsTrigger value="individuals">Individuals ({artists.length})</TabsTrigger>
            <TabsTrigger value="labels">Labels ({labels.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="individuals" className="mt-4">
            <CreatorsTable artists={artists} loading={loading} />
          </TabsContent>

          <TabsContent value="labels" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Label</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Legal Entity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Country</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                      ))}</tr>
                    )) : labels.map(l => (
                      <tr key={l.id} className="hover:bg-secondary/20">
                        <td className="px-4 py-3 font-medium text-foreground">{l.label_name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{l.legal_entity_name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{l.registered_country ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(l.created_at)}</td>
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
