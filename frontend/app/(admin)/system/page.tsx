"use client"

import { useEffect, useState } from "react"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { formatDateTime } from "@/lib/utils"
import { Settings2, Zap, Tag, AlertCircle, Save, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface PlatformParam {
  id: string; key: string; value: string; data_type: string
  description: string | null; category: string | null; changed_by: string | null
  effective_at: string; updated_at: string
}
interface FeatureFlag {
  id: string; key: string; enabled: boolean; description: string | null
  category: string | null; updated_at: string
}
interface Taxonomy {
  id: string; type: string; value: string; label: string
  active: boolean; sort_order: number
}

export default function SystemPage() {
  const [params, setParams]       = useState<PlatformParam[]>([])
  const [flags, setFlags]         = useState<FeatureFlag[]>([])
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingParam, setEditingParam] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const [paramsRes, flagsRes, taxRes] = await Promise.all([
      supabase.from("sa_platform_parameters").select("*").order("category").order("key"),
      supabase.from("sa_feature_flags").select("*").order("category").order("key"),
      supabase.from("sa_taxonomies").select("*").order("type").order("sort_order").limit(100),
    ])
    setParams(paramsRes.data ?? [])
    setFlags(flagsRes.data ?? [])
    setTaxonomies(taxRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveParam(p: PlatformParam) {
    const newVal = editingParam[p.id]
    if (!newVal || newVal === p.value) return
    const { error } = await supabase.from("sa_platform_parameters")
      .update({ value: newVal, previous_value: p.value, reason: "Updated via super admin portal" })
      .eq("id", p.id)
    if (error) { toast.error("Failed to save"); return }
    toast.success(`${p.key} updated`)
    setEditingParam(prev => { const n = { ...prev }; delete n[p.id]; return n })
    load()
  }

  async function toggleFlag(flag: FeatureFlag) {
    const { error } = await supabase.from("sa_feature_flags")
      .update({ enabled: !flag.enabled })
      .eq("id", flag.id)
    if (error) { toast.error("Failed to toggle"); return }
    toast.success(`${flag.key} ${!flag.enabled ? "enabled" : "disabled"}`)
    load()
  }

  const paramsByCategory = params.reduce<Record<string, PlatformParam[]>>((acc, p) => {
    const cat = p.category ?? "other"
    acc[cat] = [...(acc[cat] ?? []), p]
    return acc
  }, {})

  const flagsByCategory = flags.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    const cat = f.category ?? "other"
    acc[cat] = [...(acc[cat] ?? []), f]
    return acc
  }, {})

  const taxByType = taxonomies.reduce<Record<string, Taxonomy[]>>((acc, t) => {
    acc[t.type] = [...(acc[t.type] ?? []), t]
    return acc
  }, {})

  return (
    <div>
      <AdminTopbar title="System" subtitle="Parameters, feature flags & taxonomies" />
      <div className="p-6 max-w-[1200px] space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Changes take effect immediately unless scheduled.</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="params">
          <TabsList>
            <TabsTrigger value="params" className="gap-1.5"><Settings2 className="size-3.5" />Parameters</TabsTrigger>
            <TabsTrigger value="flags"  className="gap-1.5"><Zap className="size-3.5" />Feature Flags</TabsTrigger>
            <TabsTrigger value="tax"    className="gap-1.5"><Tag className="size-3.5" />Taxonomies</TabsTrigger>
          </TabsList>

          {/* ── Platform Parameters ── */}
          <TabsContent value="params" className="mt-4 space-y-5">
            {loading ? (
              <Card><CardContent className="p-6"><div className="space-y-3">{Array.from({length:5}).map((_,i)=>(
                <div key={i} className="h-8 rounded bg-secondary animate-pulse" />
              ))}</div></CardContent></Card>
            ) : Object.entries(paramsByCategory).map(([cat, catParams]) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 capitalize">{cat}</h3>
                <Card>
                  <CardContent className="p-0 divide-y divide-border">
                    {catParams.map(p => (
                      <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-foreground">{p.key}</span>
                            <Badge variant="outline" className="text-[10px]">{p.data_type}</Badge>
                          </div>
                          {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Last updated {formatDateTime(p.updated_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            className="w-28 h-7 text-sm font-mono text-center"
                            value={editingParam[p.id] ?? p.value}
                            onChange={e => setEditingParam(prev => ({ ...prev, [p.id]: e.target.value }))}
                          />
                          {editingParam[p.id] && editingParam[p.id] !== p.value && (
                            <Button size="sm" className="h-7 gap-1" onClick={() => saveParam(p)}>
                              <Save className="size-3" /> Save
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
          </TabsContent>

          {/* ── Feature Flags ── */}
          <TabsContent value="flags" className="mt-4 space-y-5">
            {loading ? (
              <Card><CardContent className="p-6 space-y-3">{Array.from({length:5}).map((_,i)=>(
                <div key={i} className="h-8 rounded bg-secondary animate-pulse" />
              ))}</CardContent></Card>
            ) : Object.entries(flagsByCategory).map(([cat, catFlags]) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 capitalize">{cat}</h3>
                <Card>
                  <CardContent className="p-0 divide-y divide-border">
                    {catFlags.map(f => (
                      <div key={f.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-foreground">{f.key}</span>
                            <Badge variant={f.enabled ? "default" : "secondary"} className="text-[10px]">
                              {f.enabled ? "ON" : "OFF"}
                            </Badge>
                          </div>
                          {f.description && <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Updated {formatDateTime(f.updated_at)}</p>
                        </div>
                        <Switch
                          checked={f.enabled}
                          onCheckedChange={() => toggleFlag(f)}
                          className="shrink-0"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
            {!loading && flags.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  No feature flags found. Run schema-4.sql seed section to populate defaults.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Taxonomies ── */}
          <TabsContent value="tax" className="mt-4 space-y-5">
            {loading ? (
              <div className="h-48 rounded bg-secondary animate-pulse" />
            ) : Object.entries(taxByType).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  No taxonomies configured yet.
                  <br />
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => toast.info("Add taxonomy — coming soon")}>
                    Add taxonomy entry
                  </Button>
                </CardContent>
              </Card>
            ) : Object.entries(taxByType).map(([type, items]) => (
              <div key={type}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 capitalize">{type.replace(/_/g, " ")}</h3>
                <Card>
                  <CardContent className="p-3 flex flex-wrap gap-2">
                    {items.map(t => (
                      <div key={t.id} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${t.active ? "border-border text-foreground" : "border-border/40 text-muted-foreground/50"}`}>
                        <span>{t.label}</span>
                        {!t.active && <span className="text-[10px] text-muted-foreground">(inactive)</span>}
                      </div>
                    ))}
                    <button
                      className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      onClick={() => toast.info("Add taxonomy value — coming soon")}
                    >
                      + Add
                    </button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
