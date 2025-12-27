'use client'

import { Authenticated, Unauthenticated } from 'convex/react'
import Sidebar from './Sidebar'
import { ReactNode, useState } from 'react'
import GlobalTransactionFAB from './GlobalTransactionFAB'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Plus, Bell } from 'lucide-react'
import TransactionDrawer from './TransactionDrawer'
import { UserButton } from '@clerk/nextjs'
import { ThemeToggle } from './ThemeToggle'
import { PushNotificationSettings } from './PushNotificationSettings'
import { BottomNav } from './BottomNav'
import { HouseholdSwitcher } from './HouseholdSwitcher'

import LandingPage from './LandingPage'
import { HouseholdProvider } from './HouseholdProvider'

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const [isTransactionOpen, setIsTransactionOpen] = useState(false)

  return (
    <>
      <Authenticated>
        <HouseholdProvider>
          <SidebarProvider>
            <div className="hidden md:block h-full">
                <Sidebar />
            </div>
            
            <SidebarInset className="pb-20 md:pb-0">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[[collapsible=icon]]/sidebar-wrapper:h-12 px-4">
               <div className="hidden md:flex items-center gap-2">
                   <SidebarTrigger className="-ml-1" />
                   <Separator orientation="vertical" className="mr-2 h-4" />
                   <h1 className="text-4x1 text-shadow-xs font-bold text-primary uppercase">Personal Finance</h1>
               </div>
               
               <div className="md:hidden">
                  <HouseholdSwitcher mode="mobile" />
               </div>

               <div className="ml-auto flex items-center gap-4">
                 <Button 
                   onClick={() => setIsTransactionOpen(true)}
                   size="sm"
                   className="hidden lg:flex items-center gap-2"
                 >
                   <Plus className="h-4 w-4" /> Add Transaction
                 </Button>
                 <ThemeToggle />
                 <UserButton>
                   <UserButton.UserProfilePage 
                     label="Notifications" 
                     labelIcon={<Bell className="h-4 w-4" />}
                     url="notifications"
                   >
                     <PushNotificationSettings />
                   </UserButton.UserProfilePage>
                 </UserButton>
               </div>
            </header>
            <main className="flex-1 p-4 lg:p-8">
               {children}
            </main>
          </SidebarInset>
          
            
          
            <GlobalTransactionFAB />
            <TransactionDrawer open={isTransactionOpen} onOpenChange={setIsTransactionOpen} />
            <BottomNav />
          
          </SidebarProvider>
          
        </HouseholdProvider>
          
      </Authenticated>
          
      <Unauthenticated>        <LandingPage />
      </Unauthenticated>
    </>
  )
}