'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { useHousehold } from '@/components/HouseholdProvider'
import TransactionDrawer from '@/components/TransactionDrawer'
import { 
  DashboardCardSkeleton, 
  RecentTransactionsSkeleton 
} from '@/components/skeletons'
import { toast } from 'sonner'
import { DailyOperationsCard } from '@/components/dashboard/DailyOperationsCard'
import { WealthCard } from '@/components/dashboard/WealthCard'
import { TransactionListGrouped } from '@/components/transactions/TransactionListGrouped'
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTransactionDialog'
import { TransactionWithDetails } from '@/components/transactions/types'

export default function Dashboard() {
  const { householdId } = useHousehold()
  const summary = useQuery(api.dashboard.getDashboardSummary, {
    householdId: householdId ?? undefined
  })
  
  // Edit & Delete State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | undefined>(undefined)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDetails | undefined>(undefined)

  const deleteTransaction = useMutation(api.transactions.deleteTransaction)

  const handleEdit = (transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction)
    setEditDrawerOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (transactionToDelete) {
        await deleteTransaction({ id: transactionToDelete._id });
        toast.success("Transaction deleted");
        setTransactionToDelete(undefined);
    }
  }

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold mb-6 md:mb-8">Dashboard</h1>

      {/* Transaction Actions Components */}
      <TransactionDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        transaction={selectedTransaction}
      />
      
      <DeleteTransactionDialog 
        open={!!transactionToDelete} 
        onOpenChange={(open) => !open && setTransactionToDelete(undefined)}
        transaction={transactionToDelete}
        onConfirm={handleDeleteConfirm}
      />

      {/* Mobile: Swipeable Cards (Carousel) */}
      <div className="block md:hidden mb-8 -mx-4 px-4">
        {summary === undefined ? (
            <div className="flex gap-4 overflow-hidden">
                <div className="basis-[85%] shrink-0">
                    <DashboardCardSkeleton />
                </div>
                <div className="basis-[85%] shrink-0">
                    <DashboardCardSkeleton />
                </div>
            </div>
        ) : (
            <Carousel 
                opts={{ align: "start", loop: false }}
                className="w-full"
            >
                <CarouselContent className="-ml-4">
                    <CarouselItem className="pl-4 basis-[85%]">
                        <DailyOperationsCard summary={summary} />
                    </CarouselItem>
                    <CarouselItem className="pl-4 basis-[85%]">
                        <WealthCard summary={summary} />
                    </CarouselItem>
                </CarouselContent>
            </Carousel>
        )}
      </div>

      {/* Desktop: Grid Layout */}
      <div className="hidden md:grid gap-6 md:grid-cols-2 mb-8">
        {summary === undefined ? (
            <>
                <DashboardCardSkeleton />
                <DashboardCardSkeleton />
            </>
        ) : (
            <>
                <DailyOperationsCard summary={summary} />
                <WealthCard summary={summary} />
            </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <Button variant="ghost" asChild>
            <Link href="/transactions" className="flex items-center gap-2">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {summary === undefined ? (
            <RecentTransactionsSkeleton />
        ) : (
            <TransactionListGrouped 
                transactions={summary?.recentTransactions as TransactionWithDetails[] || []}
                onEdit={handleEdit}
                onDelete={setTransactionToDelete}
                variant="slim"
            />
        )}
      </div>
    </div>
  )
}