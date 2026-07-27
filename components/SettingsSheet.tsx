'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Target, FolderTree, Tags, Landmark, Store, Settings, ChevronRight } from '@/components/ui/icons'

const settingsLinks = [
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/labels', label: 'Labels', icon: Tags },
  { href: '/merchants', label: 'Merchants', icon: Store },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
  { href: '/preferences', label: 'Preferences', icon: Settings },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: Props) {
  const pathname = usePathname()

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-6">
        <DrawerHeader>
          <DrawerTitle>Settings</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-1">
          {settingsLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => onOpenChange(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted/50 text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{link.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
