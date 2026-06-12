import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Id } from '../convex/_generated/dataModel'
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
import { PartyPopper, ArrowRight, CalendarClock, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { useHousehold } from './HouseholdProvider'
import confetti from 'canvas-confetti'
import { differenceInDays } from 'date-fns'
import { DatePicker } from '@/components/ui/date-picker'

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
  const updateCategory = useMutation(api.categories.update)
  const resetGoal = useMutation(api.categories.resetGoal)
  const markRead = useMutation(api.notifications.markAsRead)
  const archiveAccount = useMutation(api.accounts.archiveAccount)

  const [step, setStep] = useState<'intro' | 'transfer' | 'cleanup' | 'reset' | 'investment_update'>('intro')
  const [sourceAccountId, setSourceAccountId] = useState<string>('')
  const [destAccountId, setDestAccountId] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('')
  
  // For Reset (Bill) & Update (Investment)
  const [newTargetDate, setNewTargetDate] = useState<Date | undefined>(undefined)
  const [newTargetAmount, setNewTargetAmount] = useState<string>('')

  // For cleanup step
  const [actionForAccount, setActionForAccount] = useState<'keep' | 'close'>('keep')

  // Reset state when categoryId changes or dialog opens
  useEffect(() => {
    if (open) {
        const timer = setTimeout(() => {
            setStep('intro')
            setSourceAccountId('')
            setDestAccountId('')
            setTransferAmount('')
            setActionForAccount('keep')
            setNewTargetDate(undefined)
            setNewTargetAmount('')
            
            // Trigger Confetti
            const end = Date.now() + 3 * 1000;
            const colors = ['#a786ff', '#fd8bbc', '#eca184', '#f8deb1'];

            (function frame() {
              confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
              });
              confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
              });

              if (Date.now() < end) {
                requestAnimationFrame(frame);
              }
            }());

        }, 0)
        return () => clearTimeout(timer)
    }
  }, [categoryId, open])

  if (!category || !accounts) return null

  const savingAccounts = accounts.filter(a => a.type === 'SAVING' || a.type === 'ASSET')
  const liquidAccounts = accounts.filter(a => !a.type || a.type === 'CASH' || a.type === 'BANK' || a.type === 'E-WALLET')
  const goalType = category.goalType || 'purchase'; // Default

  const handleStartProcess = () => {
      // Pre-fill amount with target if available
      if (category.targetAmount) {
          setTransferAmount(category.targetAmount)
          setNewTargetAmount(category.targetAmount) // Default for next cycle too
      }
      
      if (goalType === 'investment') {
          setStep('investment_update')
      } else {
          setStep('transfer')
      }
  }

  const handleTransferSubmit = async () => {
      if (!sourceAccountId || !destAccountId || !transferAmount) {
          toast.error("Please fill all fields")
          return
      }

      try {
          const date = new Date();
          date.setHours(12, 0, 0, 0);

          await createTransaction({
              householdId: householdId ?? undefined,
              type: 'transfer',
              accountId: sourceAccountId as Id<"accounts">,
              toAccountId: destAccountId as Id<"accounts">,
              amount: transferAmount,
              categoryId: categoryId,
              date: date.toISOString(),
              description: `Goal Reached: ${category.name} Disbursement`,
              isGoalDisbursement: true, // Special Flag
          })
          
          toast.success("Funds transferred successfully!")
          
          if (goalType === 'bill') {
              setStep('reset')
          } else {
              setStep('cleanup')
          }
      } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : "Transfer failed")
      }
  }

  const handleResetSubmit = async () => {
      if (!newTargetDate) {
          toast.error("Please pick a next due date");
          return;
      }
      
      try {
          const date = new Date(newTargetDate);
          date.setHours(12, 0, 0, 0);

          await resetGoal({
              id: categoryId,
              newTargetDate: date.toISOString()
          });
          await markRead({ id: notificationId });
          toast.success("Cycle reset! Ready for next payment.");
          onOpenChange(false);
      } catch (e) {
          toast.error("Failed to reset cycle");
      }
  }

  const handleInvestmentUpdateSubmit = async () => {
      if (!newTargetAmount) return;
      try {
          await updateCategory({
              id: categoryId,
              targetAmount: newTargetAmount.replace(/,/g, '')
          });
          // Note: We don't mark achieved for Investment if they increase target. 
          // We just keep going. But we should clear notification.
          await markRead({ id: notificationId });
          toast.success("Target updated! Keep growing.");
          onOpenChange(false);
      } catch (e) {
          toast.error("Failed to update target");
      }
  }

  const handleMarkDone = async () => {
      await markAsAchieved({ id: categoryId });
      await markRead({ id: notificationId });
      toast.success("Marked as done!");
      onOpenChange(false);
  }

  const handleCleanupSubmit = async () => {
      await markAsAchieved({ id: categoryId })
      
      if (actionForAccount === 'close' && sourceAccountId) {
          try {
             await archiveAccount({ id: sourceAccountId as Id<"accounts"> })
             toast.success("Source account closed")
          } catch (e: unknown) {
             toast.error(`Could not close account: ${e instanceof Error ? e.message : "Unknown error"}`)
          }
      }

      await markRead({ id: notificationId })
      onOpenChange(false)
  }

  // --- UI PARTIALS ---

  const renderIntro = () => {
    const today = new Date();
    const targetDate = category.targetDate ? new Date(category.targetDate) : null;
    const daysEarly = targetDate ? differenceInDays(targetDate, today) : 0;
    const isEarly = daysEarly > 0;

    return (
    <>
        <DialogHeader>
        <div className="mx-auto bg-yellow-100 p-3 rounded-full w-fit mb-2">
            {goalType === 'investment' ? <TrendingUp className="h-8 w-8 text-blue-600" /> : 
             goalType === 'bill' ? <CalendarClock className="h-8 w-8 text-amber-600" /> :
             <PartyPopper className="h-8 w-8 text-yellow-600" />}
        </div>
        
        {isEarly && (
            <div className="mx-auto mb-3 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full w-fit flex items-center gap-1 animate-pulse">
                🚀 {daysEarly} Days Ahead of Schedule!
            </div>
        )}

        <DialogTitle className="text-center text-xl">
            {goalType === 'investment' ? 'Milestone Reached!' :
             goalType === 'bill' ? 'Bill Ready to Pay' : 'Goal Achieved!'}
        </DialogTitle>
        <DialogDescription className="text-center">
            {goalType === 'investment' ? `You've hit your target for ${category.name}. Great job building wealth!` :
             goalType === 'bill' ? `Funds for ${category.name} are ready. Time to pay?` :
             `Congratulations! You've reached your target for ${category.name}.`}
             
             {isEarly && (
                <span className="block mt-2 text-green-600 font-medium">
                    You finished {daysEarly} days early. Amazing discipline!
                </span>
             )}
        </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
             <Button onClick={handleStartProcess} className="w-full">
                {goalType === 'investment' ? 'Set New Target' :
                 goalType === 'bill' ? 'Pay Bill & Reset' : 'Spend Funds Now'}
             </Button>
             
             {goalType === 'investment' && (
                 <Button variant="secondary" onClick={handleMarkDone} className="w-full">
                    Mark as Milestone (Done)
                 </Button>
             )}
             
             {goalType === 'purchase' && (
                 <Button variant="ghost" onClick={handleMarkDone} className="w-full">
                    Just Mark as Achieved
                 </Button>
             )}
        </div>
    </>
  )};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {step === 'intro' && renderIntro()}

        {step === 'investment_update' && (
            <>
                <DialogHeader>
                    <DialogTitle>Grow Your Wealth</DialogTitle>
                    <DialogDescription>Increase your target to keep the momentum going.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid gap-2">
                        <Label>New Target Amount</Label>
                        <Input 
                            value={newTargetAmount}
                            onChange={(e) => setNewTargetAmount(e.target.value)}
                            placeholder="Amount"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setStep('intro')}>Back</Button>
                    <Button onClick={handleInvestmentUpdateSubmit}>Update Target</Button>
                </DialogFooter>
            </>
        )}

        {step === 'transfer' && (
             <>
                <DialogHeader>
                <DialogTitle>{goalType === 'bill' ? 'Pay Bill' : 'Disburse Funds'}</DialogTitle>
                <DialogDescription>
                    Move funds to your spending account.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Source ({category.name})</Label>
                        <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                                {savingAccounts.map(a => (
                                    <SelectItem key={a._id} value={a._id}>{a.name} ({new Intl.NumberFormat('en-US').format(parseFloat(a.balance.replace(/,/g, '')))})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="flex justify-center text-muted-foreground">
                        <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
                    </div>

                    <div className="grid gap-2">
                        <Label>Destination (Payment Source)</Label>
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
                        <Label>Amount</Label>
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

        {step === 'reset' && (
            <>
                <DialogHeader>
                    <DialogTitle>Reset Cycle</DialogTitle>
                    <DialogDescription>When is this bill due next?</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <div className="flex flex-col gap-2">
                        <Label>Next Due Date</Label>
                        <DatePicker
                            date={newTargetDate}
                            setDate={setNewTargetDate}
                            disabled={(date) => date < new Date()}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleResetSubmit}>Set & Finish</Button>
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
                        <Select value={actionForAccount} onValueChange={(v: 'keep' | 'close') => setActionForAccount(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="keep">Keep it active (I will use it again)</SelectItem>
                                <SelectItem value="close">Close/Archive it (I&apos;m done with it)</SelectItem>
                            </SelectContent>
                        </Select>
                        {actionForAccount === 'close' && (
                             <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                Note: Account can only be closed if balance is 0. If you didn&apos;t transfer everything, it might fail.
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