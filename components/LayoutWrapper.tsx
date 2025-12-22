'use client'

import { Authenticated, Unauthenticated } from 'convex/react'
import { SignInButton } from '@clerk/nextjs'
import Sidebar from './Sidebar'
import { ReactNode } from 'react'
import Header from './Header'
import GlobalTransactionFAB from './GlobalTransactionFAB'
import BottomNav from './BottomNav'

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <Authenticated>
        <div className="flex h-screen overflow-hidden">
          <div className="hidden lg:flex shrink-0">
            <Sidebar />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 relative">
              {children}
            </main>
          </div>
        </div>
        <BottomNav />
        <GlobalTransactionFAB />
      </Authenticated>
      <Unauthenticated>
        <div className="flex justify-center items-center h-screen">
          <SignInButton />
        </div>
      </Unauthenticated>
    </>
  )
}
