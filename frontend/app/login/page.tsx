"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { WaveLogo } from "@/components/wave-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react"
import { signInAdmin } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      /**
       * signInAdmin does two things:
       *  1. Calls supabase.auth.signInWithPassword — validates credentials
       *  2. Calls GET /auth/me on the super-admin backend (port 3003)
       *     The backend's AdminAuthGuard validates the JWT and confirms the
       *     user exists in admin_users with status = 'active'.
       *     If not an admin, the backend returns 403 and signInAdmin throws.
       */
      const identity = await signInAdmin(email, password)

      toast.success(`Welcome back, ${identity.email}`)
      router.push("/overview")
    } catch (err: any) {
      const msg: string = err?.message ?? "Login failed"

      // Surface a friendlier message for the common 403 case
      if (msg.includes("403") || msg.toLowerCase().includes("not a wave admin")) {
        setErrorMsg("Access denied — your account is not registered as a Wave admin.")
      } else if (msg.toLowerCase().includes("inactive") || msg.toLowerCase().includes("suspended")) {
        setErrorMsg("Your admin account is inactive. Contact a super admin.")
      } else if (
        msg.toLowerCase().includes("invalid login") ||
        msg.toLowerCase().includes("invalid credentials") ||
        msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("credentials")
      ) {
        setErrorMsg("Invalid email or password. (Use `wave_admin` — no spaces.)")
      } else {
        setErrorMsg(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            <WaveLogo />
            <span className="text-xl font-bold text-foreground">Wave</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
            <ShieldCheck className="size-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Super Admin Console</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          <h1 className="mb-1 text-lg font-semibold text-foreground">Sign in</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Restricted to Wave platform operators.
          </p>

          {/* Error banner */}
          {errorMsg && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@wave.fm"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrorMsg(null) }}
                required
                autoFocus
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrorMsg(null) }}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verifying admin access…
                </>
              ) : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Wave Super Admin · Internal use only
        </p>
      </div>
    </div>
  )
}
