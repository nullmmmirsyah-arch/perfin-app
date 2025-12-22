'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserButton } from '@clerk/nextjs'

import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet, 
  Tags, 
  PiggyBank, 
  Hash 
} from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/labels', label: 'Labels', icon: Hash },
]

export default function Sidebar({ className, hideLogo }: { className?: string, hideLogo?: boolean }) {
  const pathname = usePathname()

  return (
    <div className={cn("flex flex-col w-64 p-4 border-r bg-muted/40 h-screen shrink-0", className)}>
      <div>
        {!hideLogo && <h1 className="text-2xl font-bold px-2">Perfin</h1>}
        <nav className={cn("mt-8", hideLogo && "mt-2")}>
          <ul className="space-y-1">
            {links.map(link => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 p-2 px-3 rounded-md text-sm font-medium transition-colors hover:text-primary hover:bg-muted',
                    pathname === link.href ? 'bg-muted text-primary' : 'text-muted-foreground'
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="grow" />
      <div className="flex items-center gap-4 px-2">
        <UserButton />
        <span className="text-sm font-medium">Account</span>
      </div>
    </div>
  )
}
