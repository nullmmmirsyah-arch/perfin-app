'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet, 
  PiggyBank, 
  Menu,
  Target
} from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useState } from 'react'

export function BottomNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = [
      { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
      { href: '/transactions', label: 'Trans', icon: ArrowLeftRight },
      { href: '/budgets', label: 'Budgets', icon: PiggyBank },
    ]

    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
                  {links.slice(0, 2).map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href
                    
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                          isActive 
                            ? "text-primary font-medium" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", isActive && "fill-current/20")} />
                        <span className="text-[10px]">{link.label}</span>
                      </Link>
                    )
                  })}
          
                  {/* Precise Space for the Floating FAB */}
                          <div className="w-full flex flex-col items-center justify-center opacity-0 pointer-events-none">
                             <div className="h-5 w-5" />
                             <span className="text-[10px]">Add</span>
                          </div>
                  
                          {links.slice(2).map((link) => {
                            const Icon = link.icon
                            const isActive = pathname === link.href
                            
                            return (
                              <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                  "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                                  isActive 
                                    ? "text-primary font-medium" 
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <Icon className={cn("h-5 w-5", isActive && "fill-current/20")} />
                                <span className="text-[10px]">{link.label}</span>
                              </Link>
                            )
                          })}
                  
                          {/* More Menu Drawer */}
                          <Drawer open={open} onOpenChange={setOpen}>
                            <DrawerTrigger asChild>
                              <button className="flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground hover:text-foreground">
                                <Menu className="h-5 w-5" />
                                <span className="text-[10px]">Menu</span>
                              </button>
                            </DrawerTrigger>
                            <DrawerContent>
                              <DrawerHeader className="text-left">
                                <DrawerTitle>App Navigation</DrawerTitle>
                              </DrawerHeader>
                              <div className="p-4 grid gap-4 pb-10">
                                <Link 
                                  href="/goals" 
                                  onClick={() => setOpen(false)}
                                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                                >
                                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                      <Target className="h-5 w-5" />
                                   </div>
                                   <div className="flex-1">
                                      <p className="font-medium">Goals</p>
                                      <p className="text-xs text-muted-foreground">Track your savings targets</p>
                                   </div>
                                </Link>
                                <Link 
                                  href="/accounts" 
                                  onClick={() => setOpen(false)}
                                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                                >
                                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                      <Wallet className="h-5 w-5" />
                                   </div>
                                   <div className="flex-1">
                                      <p className="font-medium">Accounts</p>
                                      <p className="text-xs text-muted-foreground">Bank, Cash, and Assets</p>
                                   </div>
                                </Link>
                                <Link 
                                  href="/accounts" 
                                  onClick={() => setOpen(false)}
                                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                                >
                                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                      <Wallet className="h-5 w-5" />
                                   </div>
                                   <div className="flex-1">
                                      <p className="font-medium">Accounts</p>
                                      <p className="text-xs text-muted-foreground">Bank, Cash, and Assets</p>
                                   </div>
                                </Link>
                                <Link 
                                  href="/categories" 
                                  onClick={() => setOpen(false)}
                                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                                >
                                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                      <ArrowLeftRight className="h-5 w-5" />
                                   </div>
                                   <div className="flex-1">
                                      <p className="font-medium">Categories</p>
                                      <p className="text-xs text-muted-foreground">Manage transaction categories</p>
                                   </div>
                                </Link>
                                <Link 
                                  href="/labels" 
                                  onClick={() => setOpen(false)}
                                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                                >
                                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                      <Menu className="h-5 w-5" />
                                   </div>
                                   <div className="flex-1">
                                      <p className="font-medium">Labels</p>
                                      <p className="text-xs text-muted-foreground">Organize with custom tags</p>
                                   </div>
                                </Link>
                              </div>
                            </DrawerContent>
                          </Drawer>
                  
        </div>
      </div>
    )
}

  