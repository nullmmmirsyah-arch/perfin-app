'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  FileBarChart,
  Plus,
} from '@/components/ui/icons'
import TransactionDrawer from '@/components/TransactionDrawer'

export function BottomNav() {
  const pathname = usePathname()
  const [fabOpen, setFabOpen] = useState(false)

  const links = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/transactions', label: 'Trans', icon: ArrowLeftRight },
    { href: '/budgets', label: 'Budgets', icon: PiggyBank },
    { href: '/report', label: 'Reports', icon: FileBarChart },
  ]

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t pb-safe">
        <div className="flex items-center justify-around h-16 px-1">
          {links.slice(0, 2).map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors min-w-0",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "fill-current/20")} />
                <span className="text-[10px] leading-tight">{link.label}</span>
              </Link>
            )
          })}

          {/* FAB spacer */}
          <div className="flex flex-col items-center justify-center w-full h-full gap-0.5 relative">
            <button
              onClick={() => setFabOpen(true)}
              className="absolute -top-4 flex flex-col items-center gap-0.5"
              aria-label="Add transaction"
            >
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg border-4 border-background flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-[10px] leading-tight text-primary font-medium">Tambah</span>
            </button>
          </div>

          {links.slice(2).map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors min-w-0",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "fill-current/20")} />
                <span className="text-[10px] leading-tight">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <TransactionDrawer
        open={fabOpen}
        onOpenChange={setFabOpen}
      />
    </>
  )
}
