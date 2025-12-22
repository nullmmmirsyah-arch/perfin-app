'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet, 
  PiggyBank, 
  Menu 
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import Sidebar from './Sidebar'

const mainLinks = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'History', icon: ArrowLeftRight },
  { href: '/accounts', label: 'Wallet', icon: Wallet },
  { href: '/budgets', label: 'Budget', icon: PiggyBank },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t lg:hidden pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {mainLinks.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 gap-1 h-full transition-colors',
              pathname === link.href ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <link.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">{link.label}</span>
          </Link>
        ))}
        
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center flex-1 gap-1 h-full text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="p-0 h-[80vh] rounded-t-2xl overflow-hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            <div className="h-full">
                <Sidebar className="w-full h-full border-none bg-background" hideLogo />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
