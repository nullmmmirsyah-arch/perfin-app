'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TransactionDrawer from '@/components/TransactionDrawer'

export default function GlobalTransactionFAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="fixed bottom-24 lg:bottom-8 right-6 lg:right-8 z-50">
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-shadow bg-primary text-primary-foreground"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Create Transaction</span>
        </Button>
      </div>

      <TransactionDrawer
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
