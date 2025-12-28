'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Doc, Id } from '../convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Check, PartyPopper, ArrowRight, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useHousehold } from './HouseholdProvider'
import { useEffect } from 'react'

type GoalAchievementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: Id<"categories">
  notificationId: Id<"notifications">
}

export default function GoalAchievementDialog({
  open,
  onOpenChange,
  categoryId,
  notificationId
}: GoalAchievementDialogProps) {
  const { householdId } = useHousehold()
  const category = useQuery(api.categories.get, { householdId: householdId ?? undefined, showArchived: true })
        ?.find(c => c._id === categoryId)
  
  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined, showArchived: false })
  
  const createTransaction = useMutation(api.transactions.create)
  const markAsAchieved = useMutation(api.categories.markAsAchieved)
  const markRead = useMutation(api.notifications.markAsRead)
  const archiveAccount = useMutation(api.accounts.archiveAccount)

  const [step, setStep] = useState<'intro' | 'transfer' | 'cleanup'>('intro')
  const [sourceAccountId, setSourceAccountId] = useState<string>('')
  const [destAccountId, setDestAccountId] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('')
  
  // For cleanup step
  const [actionForAccount, setActionForAccount] = useState<'keep' | 'close'>('keep')

  // Reset state when categoryId changes or dialog opens
  useEffect(() => {
    if (open) {
        setStep('intro')
        setSourceAccountId('')
        setDestAccountId('')
        setTransferAmount('')
        setActionForAccount('keep')
    }
  }, [categoryId, open])

  if (!category || !accounts) return null

  const savingAccounts = accounts.filter(a => a.type === 'SAVING' || a.type === 'ASSET')
  const liquidAccounts = accounts.filter(a => !a.type || a.type === 'CASH' || a.type === 'BANK' || a.type === 'E-WALLET')

  const handleSkipToArchive = async () => {
    // Just mark achieved and close
    await markAsAchieved({ id: categoryId })
    await markRead({ id: notificationId })
    toast.success("Goal marked as achieved!")
    onOpenChange(false)
  }

  const handleStartProcess = () => {
      // Pre-fill amount with target if available
      if (category.targetAmount) {
          setTransferAmount(category.targetAmount)
      }
      setStep('transfer')
  }

  const handleTransferSubmit = async () => {
      if (!sourceAccountId || !destAccountId || !transferAmount) {
          toast.error("Please fill all fields")
          return
      }

      try {
          await createTransaction({
              householdId: householdId ?? undefined,
              type: 'transfer',
              accountId: sourceAccountId as Id<"accounts">,
              toAccountId: destAccountId as Id<"accounts">,
              amount: transferAmount,
              categoryId: categoryId,
              date: new Date().toISOString(),
              description: `Goal Reached: ${category.name} Disbursement`,
              isGoalDisbursement: true, // Special Flag
          })
          
          toast.success("Funds transferred successfully!")
          setStep('cleanup')
      } catch (e: any) {
          toast.error(e.message)
      }
  }

  const handleCleanupSubmit = async () => {
      // 1. Mark Category Achieved
      await markAsAchieved({ id: categoryId })
      
      // 2. Handle Account
      if (actionForAccount === 'close' && sourceAccountId) {
          try {
             await archiveAccount({ id: sourceAccountId as Id<"accounts"> })
             toast.success("Source account closed")
          } catch (e: any) {
             toast.error(`Could not close account: ${e.message}`)
          }
      }

      // 3. Mark Notification Read
      await markRead({ id: notificationId })

      onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {step === 'intro' && (
            <>
                <DialogHeader>
                <div className="mx-auto bg-yellow-100 p-3 rounded-full w-fit mb-2">
                    <PartyPopper className="h-8 w-8 text-yellow-600" />
                </div>
                <DialogTitle className="text-center text-xl">Goal Achieved!</DialogTitle>
                <DialogDescription className="text-center">
                    Congratulations! You've reached your target for <strong>{category.name}</strong>.
                    <br/>
                    What would you like to do with the funds?
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                     <Button onClick={handleStartProcess} className="w-full bg-green-600 hover:bg-green-700">
                        <Wallet className="mr-2 h-4 w-4" /> Spend Funds Now
                     </Button>
                     <Button variant="secondary" onClick={handleSkipToArchive} className="w-full">
                        <Check className="mr-2 h-4 w-4" /> Just Mark as Achieved
                     </Button>
                </div>
            </>
        )}

        {step === 'transfer' && (
             <>
                <DialogHeader>
                <DialogTitle>Disburse Funds</DialogTitle>
                <DialogDescription>
                    Move funds from your saving account to a spending account (e.g., Wallet/Bank).
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Source (Saving Account)</Label>
                        <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select saving account" />
                            </SelectTrigger>
                            <SelectContent>
                                {savingAccounts.map(a => (
                                    <SelectItem key={a._id} value={a._id}>{a.name} ({new Intl.NumberFormat('en-US').format(parseFloat(a.balance.replace(/,/g, '')))})</SelectItem>
                                ))}
                                {savingAccounts.length === 0 && <SelectItem value="none" disabled>No saving accounts found</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="flex justify-center text-muted-foreground">
                        <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
                    </div>

                    <div className="grid gap-2">
                        <Label>Destination (Spending Account)</Label>
                        <Select value={destAccountId} onValueChange={setDestAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select spending account" />
                            </SelectTrigger>
                            <SelectContent>
                                {liquidAccounts.map(a => (
                                    <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Amount to Disburse</Label>
                        <Input 
                            value={transferAmount} 
                            onChange={(e) => setTransferAmount(e.target.value)}
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStep('intro')}>Back</Button>
                    <Button onClick={handleTransferSubmit}>Confirm Transfer</Button>
                </DialogFooter>
            </>
        )}

        {step === 'cleanup' && (
             <>
                <DialogHeader>
                <DialogTitle>Wrap Up</DialogTitle>
                <DialogDescription>
                    Almost done! What should happen to the saving account?
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Source Account Action</Label>
                        <Select value={actionForAccount} onValueChange={(v: any) => setActionForAccount(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="keep">Keep it active (I will use it again)</SelectItem>
                                <SelectItem value="close">Close/Archive it (I'm done with it)</SelectItem>
                            </SelectContent>
                        </Select>
                        {actionForAccount === 'close' && (
                             <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                Note: Account can only be closed if balance is 0. If you didn't transfer everything, it might fail.
                             </p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleCleanupSubmit}>Finish</Button>
                </DialogFooter>
            </>
        )}
      </DialogContent>
    </Dialog>
  )
}
