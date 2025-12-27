'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TransactionDrawer from '@/components/TransactionDrawer'

export default function GlobalTransactionFAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile: Centered Docked Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="rounded-full h-14 w-14 shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:shadow-xl transition-all bg-primary text-primary-foreground border-4 border-background"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Create Transaction</span>
        </Button>
      </div>

      {/* Tablet: Bottom Right (if needed, but usually Sidebar covers functionality) */}
      <div className="hidden md:block lg:hidden fixed bottom-8 right-8 z-50">
         <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="rounded-full h-14 w-14 shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <TransactionDrawer
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
