'use client'

import { Authenticated, Unauthenticated } from 'convex/react'
import { SignInButton } from '@clerk/nextjs'
import Sidebar from './Sidebar'
import { ReactNode } from 'react'
import Header from './Header'

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <Authenticated>
        <div className="flex h-screen">
          <div className="hidden lg:flex">
            <Sidebar />
          </div>
          <div className="flex flex-col flex-1">
            <Header />
            <main className="flex-1 p-4 overflow-y-auto lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </Authenticated>
      <Unauthenticated>
        <div className="flex justify-center items-center h-screen">
          <SignInButton />
        </div>
      </Unauthenticated>
    </>
  )
}
