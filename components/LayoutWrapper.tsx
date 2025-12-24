'use client'

import { Authenticated, Unauthenticated } from 'convex/react'
import { SignInButton } from '@clerk/nextjs'
import Sidebar from './Sidebar'
import { ReactNode } from 'react'
import GlobalTransactionFAB from './GlobalTransactionFAB'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

import LandingPage from './LandingPage'
import { HouseholdProvider } from './HouseholdProvider'

export default function LayoutWrapper({ children }: { children: ReactNode }) {
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
               <h1 className="text-sm font-medium">Perfin</h1>
            </header>
            <main className="flex-1 p-4 lg:p-8">
               {children}
            </main>
          </SidebarInset>
          
            
          
            <GlobalTransactionFAB />
          
          </SidebarProvider>
          
        </HouseholdProvider>
          
      </Authenticated>
          
      <Unauthenticated>        <LandingPage />
      </Unauthenticated>
    </>
  )
}