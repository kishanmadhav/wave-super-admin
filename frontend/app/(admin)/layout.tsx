import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { AdminGate } from "@/components/layout/admin-gate"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="flex h-screen bg-background overflow-hidden">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminGate>
  )
}
