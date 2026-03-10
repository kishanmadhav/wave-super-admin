"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getAdminIdentity } from "@/lib/auth"

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    getAdminIdentity().then((identity) => {
      if (!mounted) return
      if (!identity) {
        router.replace(`/login`)
        return
      }
      setReady(true)
    })
    return () => {
      mounted = false
    }
  }, [router, pathname])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verifying admin session…
      </div>
    )
  }

  return <>{children}</>
}

