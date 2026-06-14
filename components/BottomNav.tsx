'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Target,
  FileBarChart,
} from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  const links = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/transactions', label: 'Trans', icon: ArrowLeftRight },
    { href: '/budgets', label: 'Budgets', icon: PiggyBank },
    { href: '/goals', label: 'Goals', icon: Target },
    { href: '/report', label: 'Reports', icon: FileBarChart },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t pb-safe">
      <div className="flex items-center justify-around h-16 px-1">
        {links.map((link) => {
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
  )
}

  