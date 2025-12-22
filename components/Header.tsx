'use client'

import { UserButton } from '@clerk/nextjs'

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4 border-b lg:hidden bg-background sticky top-0 z-30">
      <h1 className="text-xl font-bold">Perfin</h1>
      <UserButton afterSignOutUrl="/" />
    </header>
  )
}
