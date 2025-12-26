'use client'

import { Authenticated, Unauthenticated } from 'convex/react'
import Sidebar from './Sidebar'
import { ReactNode, useState } from 'react'
import GlobalTransactionFAB from './GlobalTransactionFAB'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import TransactionDrawer from './TransactionDrawer'

import LandingPage from './LandingPage'
import { HouseholdProvider } from './HouseholdProvider'

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const [isTransactionOpen, setIsTransactionOpen] = useState(false)

  return (
    <>
      <Authenticated>
        <HouseholdProvider>
          <SidebarProvider>
            <Sidebar />
            <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 px-4">
               <SidebarTrigger className="-ml-1" />
               <Separator orientation="vertical" className="mr-2 h-4" />
               <h1 className="text-shadow-xs font-medium text-primary">Perfin</h1>
               <div className="ml-auto">
                 <Button 
                   onClick={() => setIsTransactionOpen(true)}
                   size="sm"
                   className="hidden lg:flex items-center gap-2"
                 >
                   <Plus className="h-4 w-4" /> Add Transaction
                 </Button>
               </div>
            </header>
            <main className="flex-1 p-4 lg:p-8">
               {children}
            </main>
          </SidebarInset>
          
            
          
            <GlobalTransactionFAB />
            <TransactionDrawer open={isTransactionOpen} onOpenChange={setIsTransactionOpen} />
          
          </SidebarProvider>
          
        </HouseholdProvider>
          
      </Authenticated>
          
      <Unauthenticated>        <LandingPage />
      </Unauthenticated>
    </>
  )
}