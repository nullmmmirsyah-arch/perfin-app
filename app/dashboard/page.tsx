'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useHousehold } from '@/components/HouseholdProvider'
import TransactionDrawer from '@/components/TransactionDrawer'
import { 
  DashboardCardSkeleton, 
  RecentTransactionsSkeleton 
} from '@/components/skeletons'
import { toast } from 'sonner'
import { DailyOperationsCard } from '@/components/dashboard/DailyOperationsCard'
import { DailyGuidance } from '@/components/dashboard/DailyGuidance'
import { BudgetSummary } from '@/components/dashboard/BudgetSummary'
import { TodaySpending } from '@/components/dashboard/TodaySpending'
import { BudgetAttentionList } from '@/components/dashboard/BudgetAttentionList'
import { MobileDashboardTabs } from '@/components/dashboard/MobileDashboardTabs'
import { TransactionListGrouped } from '@/components/transactions/TransactionListGrouped'
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTransactionDialog'
import { TransactionWithDetails } from '@/components/transactions/types'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { MonthlyComparison } from '@/components/dashboard/MonthlyComparison'
import { RecurringSummary } from '@/components/dashboard/RecurringSummary'
import { QuickAdjust } from '@/components/dashboard/QuickAdjust'
import { parseAmount, formatCurrency } from '@/lib/utils'

import { motion } from 'framer-motion'
import { fadeInUp, staggerContainer, scaleIn } from '@/lib/animations'
import { PageHeader } from '@/components/PageHeader'
import { usePrivacyMode } from '@/hooks/use-privacy-mode'
import { useEffect } from 'react'
import { TRANSACTION_TYPES } from '../../convex/lib/constants'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function Dashboard() {
  const { householdId, households } = useHousehold()
  const activeHousehold = households.find(h => h._id === householdId)
  const budgetStartDay = activeHousehold?.budgetStartDay || 1;

  const summary = useQuery(api.dashboard.getDashboardSummary, {
    householdId: householdId ?? undefined
  })
  
  // Edit & Delete State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | undefined>(undefined)
  const [initialFormData, setInitialFormData] = useState<any>(undefined)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDetails | undefined>(undefined)
  const [receivableToForgive, setReceivableToForgive] = useState<any>(undefined)
  
  // Privacy Mode
  const { isPrivacyMode, togglePrivacyMode, isLoaded } = usePrivacyMode()

  const deleteTransaction = useMutation(api.transactions.deleteTransaction)
  const forgiveReceivable = useMutation(api.transactions.forgiveReceivable)

  const handleEdit = (transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction)
    setInitialFormData(undefined) // Clear pre-fill
    setEditDrawerOpen(true)
  }

  // --- Receivables Event Handlers ---
  useEffect(() => {
    const handleSettle = (e: any) => {
        const tx = e.detail;
        const amountValue = parseAmount(tx.amount);
        const paidValue = parseAmount(tx.amountPaid);
        const remaining = amountValue - paidValue;

        // Pre-fill for Income
        setInitialFormData({
            type: TRANSACTION_TYPES.INCOME,
            amount: new Intl.NumberFormat('en-US').format(remaining), // Format with separators
            categoryId: tx.categoryId,
            description: `Settlement: ${tx.description || tx.categoryName}`,
            owedBy: tx.owedBy,
            parentTransactionId: tx._id // The secret sauce for partial payments
        });
        setSelectedTransaction(undefined); // Create mode
        setEditDrawerOpen(true);
    };

    const handleForgive = (e: any) => {
        setReceivableToForgive(e.detail);
    };

    window.addEventListener('PERFIN_SETTLE_RECEIVABLE', handleSettle);
    window.addEventListener('PERFIN_FORGIVE_RECEIVABLE', handleForgive);
    return () => {
        window.removeEventListener('PERFIN_SETTLE_RECEIVABLE', handleSettle);
        window.removeEventListener('PERFIN_FORGIVE_RECEIVABLE', handleForgive);
    };
  }, []);

  const handleForgiveConfirm = async () => {
    if (receivableToForgive) {
        try {
            await forgiveReceivable({ id: receivableToForgive._id });
            toast.success("Debt forgiven");
            setReceivableToForgive(undefined);
        } catch (err) {
            toast.error("Failed to forgive debt");
        }
    }
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
        initialData={initialFormData}
      />
      
      <DeleteTransactionDialog 
        open={!!transactionToDelete} 
        onOpenChange={(open) => !open && setTransactionToDelete(undefined)}
        transaction={transactionToDelete}
        onConfirm={handleDeleteConfirm}
      />

      <AlertDialog open={!!receivableToForgive} onOpenChange={(open) => !open && setReceivableToForgive(undefined)}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Forgive this debt?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm space-y-3">
                <p>
                  Are you sure you want to forgive the remaining <span className="font-bold text-foreground">{receivableToForgive ? formatCurrency(parseAmount(receivableToForgive.amount) - parseAmount(receivableToForgive.amountPaid)) : ""}</span> from <span className="font-bold text-foreground">{receivableToForgive?.owedBy || "this person"}</span>?
                </p>
                <div className="bg-muted/50 p-3 rounded-lg border border-dashed text-xs italic">
                  This transaction will disappear from your &quot;Lent&quot; list but will remain as a personal expense in your budget history.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel className="w-full sm:w-auto rounded-full">Keep Waiting</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleForgiveConfirm} 
                className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
            >
              Forgive Debt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile: Daily Decision View (vertical scroll) */}
      <motion.div
        className="block md:hidden space-y-4 mb-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {summary === undefined ? (
          <DashboardCardSkeleton />
        ) : (
          <>
            <motion.div variants={fadeInUp}><DailyGuidance summary={summary} isPrivacyMode={isPrivacyMode} /></motion.div>
            <motion.div variants={fadeInUp}><BudgetSummary summary={summary} isPrivacyMode={isPrivacyMode} /></motion.div>
            <motion.div variants={fadeInUp}><TodaySpending summary={summary} isPrivacyMode={isPrivacyMode} /></motion.div>
            <motion.div variants={fadeInUp}><BudgetAttentionList summary={summary} isPrivacyMode={isPrivacyMode} /></motion.div>
            <motion.div variants={fadeInUp}><MobileDashboardTabs summary={summary} isPrivacyMode={isPrivacyMode} /></motion.div>
          </>
        )}
      </motion.div>

      {/* Desktop: Grid Layout */}
      <motion.div
        className="hidden md:grid gap-6 md:grid-cols-2 mb-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {summary === undefined ? (
            <>
                <motion.div variants={scaleIn}><DashboardCardSkeleton /></motion.div>
                <motion.div variants={scaleIn}><DashboardCardSkeleton /></motion.div>
            </>
        ) : (
            <>
                <motion.div variants={fadeInUp} className="flex flex-col gap-6">
                  <DailyOperationsCard summary={summary} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
                  <QuickAdjust
                    householdId={householdId ?? undefined}
                    summary={summary}
                    isPrivacyMode={isPrivacyMode}
                  />
                </motion.div>
                <motion.div variants={fadeInUp} className="flex flex-col gap-6">
                  <TrendChart householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} />
                  <MonthlyComparison householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} />
                  <RecurringSummary householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} />
                </motion.div>
            </>
        )}
      </motion.div>

      <motion.div
        className="space-y-4"
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
      >
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
      </motion.div>
    </div>
  )
}