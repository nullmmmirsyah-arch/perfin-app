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

import { PageHeader } from '@/components/PageHeader'
import { usePrivacyMode } from '@/hooks/use-privacy-mode'

export default function Dashboard() {
  const { householdId } = useHousehold()
  const summary = useQuery(api.dashboard.getDashboardSummary, {
    householdId: householdId ?? undefined
  })
  
  // Edit & Delete State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | undefined>(undefined)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDetails | undefined>(undefined)
  
  // Privacy Mode
  const { isPrivacyMode, togglePrivacyMode, isLoaded } = usePrivacyMode()

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

  // Prevent hydration mismatch or layout shift if needed, but here simple rendering is fine.
  // The hook handles isLoaded if we want to show a skeleton, but for privacy it's better to default to hidden (safe).

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your daily operations and wealth."
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={togglePrivacyMode}
      />

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
                        <DailyOperationsCard summary={summary} isPrivacyMode={isPrivacyMode} />
                    </CarouselItem>
                    <CarouselItem className="pl-4 basis-[85%]">
                        <WealthCard summary={summary} isPrivacyMode={isPrivacyMode} />
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
                <DailyOperationsCard summary={summary} isPrivacyMode={isPrivacyMode} />
                <WealthCard summary={summary} isPrivacyMode={isPrivacyMode} />
            </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold tracking-tight">Recent Transactions</h2>
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
            />
        )}
      </div>
    </div>
  )
}