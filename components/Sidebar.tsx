'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserButton } from '@clerk/nextjs'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/categories', label: 'Categories' },
  { href: '/labels', label: 'Labels' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 p-4 border-r bg-muted/40 h-screen">
      <div>
        <h1 className="text-2xl font-bold">Perfin</h1>
        <nav className="mt-8">
          <ul className="space-y-2">
            {links.map(link => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    'block p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-muted',
                    pathname === link.href && 'bg-muted text-primary'
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="grow" />
      <div className="flex items-center gap-4">
        <UserButton />
      </div>
    </div>
  )
}
