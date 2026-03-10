"use client"

import Link from "next/link"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, ArrowRight } from "lucide-react"

export default function UsersPage() {
  return (
    <div>
      <AdminTopbar title="Users" subtitle="Creator accounts" />
      <div className="p-6 max-w-[600px]">
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Users className="size-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Creator accounts live on the Creators page</h2>
              <p className="text-sm text-muted-foreground">
                View, search, and manage all creator accounts (artists, bands, labels) from the Creators section.
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/creators">
                Go to Creators <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
