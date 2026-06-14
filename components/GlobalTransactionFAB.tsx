'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TransactionDrawer from '@/components/TransactionDrawer'

export default function GlobalTransactionFAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
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
