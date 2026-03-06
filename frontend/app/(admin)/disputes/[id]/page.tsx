"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { formatDateTime } from "@/lib/utils"
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Clock } from "lucide-react"
import { toast } from "sonner"

interface Dispute {
  id: string; type: string; target_type: string; target_id: string | null
  target_name: string | null; claimant_id: string | null; claimant_name: string | null
  severity: string; status: string; description: string | null
  evidence_urls: string[] | null; priority: number | null
  admin_notes: string | null; resolution: string | null
  created_at: string; updated_at: string
}

const SEVERITY_BADGE: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-primary/15 text-primary",
  high: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive",
}

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminNote, setAdminNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from("disputes").select("*").eq("id", id).single().then(({ data }) => {
      setDispute(data)
      setAdminNote(data?.admin_notes ?? "")
      setLoading(false)
    })
  }, [id])

  async function updateStatus(status: string) {
    setSaving(true)
    const { error } = await supabase.from("disputes")
      .update({ status, admin_notes: adminNote })
      .eq("id", id)
    if (error) toast.error("Update failed")
    else { toast.success(`Dispute ${status}`); setDispute(prev => prev ? { ...prev, status } : prev) }
    setSaving(false)
  }

  if (loading) return (
    <div><AdminTopbar title="Dispute Detail" />
      <div className="p-6 flex items-center justify-center min-h-64 text-muted-foreground">Loading…</div>
    </div>
  )
  if (!dispute) return (
    <div><AdminTopbar title="Dispute Not Found" />
      <div className="p-6 text-muted-foreground">Dispute not found.</div>
    </div>
  )

  return (
    <div>
      <AdminTopbar title="Dispute Detail" />
      <div className="p-6 max-w-[900px] space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/disputes")} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to Disputes
        </Button>

        {/* Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground capitalize">{dispute.type.replace(/_/g, " ")}</h2>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${SEVERITY_BADGE[dispute.severity]}`}>
                    {dispute.severity}
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">{dispute.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">ID: {dispute.id.slice(0, 16)}…</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3" />{formatDateTime(dispute.created_at)}
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="text-foreground font-medium capitalize">{dispute.target_name ?? dispute.target_id?.slice(0, 12) ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{dispute.target_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Claimant</p>
                <p className="text-foreground font-medium">{dispute.claimant_name ?? "Platform / System"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Priority</p>
                <p className="text-foreground font-medium">{dispute.priority ?? "Normal"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        {dispute.description && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{dispute.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Evidence */}
        {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Evidence URLs</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {dispute.evidence_urls.map((url, i) => (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">{url}</a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Resolution if resolved */}
        {dispute.resolution && (
          <Card>
            <CardHeader><CardTitle className="text-sm text-success">Resolution</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{dispute.resolution}</p>
            </CardContent>
          </Card>
        )}

        {/* Admin actions */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Admin Actions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Internal note</p>
              <Textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Add internal notes (not visible to users)…"
                className="text-sm min-h-[80px] resize-y"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => updateStatus("resolved")} disabled={saving}>
                <CheckCircle2 className="size-3.5" /> Mark Resolved
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-warning border-warning/40" onClick={() => updateStatus("escalated")} disabled={saving}>
                <AlertTriangle className="size-3.5" /> Escalate
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => updateStatus("closed")} disabled={saving}>
                <XCircle className="size-3.5" /> Close
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground" onClick={() => toast.info("Request info — coming soon")} disabled={saving}>
                <MessageSquare className="size-3.5" /> Request Info
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
