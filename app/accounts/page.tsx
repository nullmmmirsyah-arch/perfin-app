'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Doc } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, Edit, Archive, History } from 'lucide-react'
import AccountDrawer from '@/components/AccountDrawer'
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
import { toast } from 'sonner'
import { useHousehold } from '@/components/HouseholdProvider'
import { AccountsListSkeleton } from '@/components/skeletons'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight } from "lucide-react"

export default function AccountsPage() {
  const [open, setOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Doc<'accounts'> | undefined>(undefined)
  const [accountToDelete, setAccountToDelete] = useState<Doc<'accounts'> | undefined>(undefined)
  const [accountToClose, setAccountToClose] = useState<Doc<'accounts'> | undefined>(undefined)
  const [showClosed, setShowClosed] = useState(false)

  const { householdId } = useHousehold()
  
  // Fetch ALL accounts (both active and archived) to handle client-side filtering comfortably
  const accounts = useQuery(api.accounts.get, { 
    householdId: householdId ?? undefined,
    showArchived: true 
  })
  
  const deleteAccount = useMutation(api.accounts.deleteAccount)
  const archiveAccount = useMutation(api.accounts.archiveAccount)

  const handleCreate = () => {
    setSelectedAccount(undefined)
    setOpen(true)
  }

  const handleEdit = (account: Doc<'accounts'>) => {
    setSelectedAccount(account)
    setOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (accountToDelete) {
      try {
        await deleteAccount({ id: accountToDelete._id })
        toast.success("Account deleted")
      } catch (error: any) {
        toast.error("Failed to delete account")
      }
      setAccountToDelete(undefined)
    }
  }

  const handleCloseConfirm = async () => {
    if (accountToClose) {
        try {
            await archiveAccount({ id: accountToClose._id })
            toast.success("Account closed/archived")
        } catch (error: any) {
            toast.error(error.message || "Failed to close account")
        }
        setAccountToClose(undefined)
    }
  }

  if (accounts === undefined) {
    return <div className="p-8"><AccountsListSkeleton /></div>
  }

  const activeAccounts = accounts.filter(a => !a.isArchived)
  const archivedAccounts = accounts.filter(a => a.isArchived)

  const liquidAccounts = activeAccounts.filter(a => !a.type || a.type === 'CASH' || a.type === 'BANK' || a.type === 'E-WALLET')
  const specialAccounts = activeAccounts.filter(a => a.type === 'ASSET' || a.type === 'SAVING' || a.type === 'INVESTMENT')

  const liquidTotal = liquidAccounts.reduce((sum, a) => sum + parseFloat(a.balance.replace(/,/g, '') || '0'), 0)
  const specialTotal = specialAccounts.reduce((sum, a) => sum + parseFloat(a.balance.replace(/,/g, '') || '0'), 0)

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(isNaN(num) ? 0 : num);
  };

  const AccountCard = ({ account }: { account: Doc<'accounts'> }) => {
    const isAsset = account.type === 'ASSET';
    const quantity = account.quantity ?? parseFloat(account.initialQuantity || '0');
    const unit = account.unit || '';
    const realizedProfit = account.totalRealizedProfit || 0;
    const isArchived = account.isArchived;

    return (
      <Card className={`p-4 flex flex-row justify-between items-center shadow-sm ${isArchived ? 'opacity-60 bg-muted/30' : ''}`}>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{account.name}</p>
            {isArchived && <Badge variant="secondary" className="text-xs h-5">Closed</Badge>}
            {account.type === 'SAVING' && <Badge variant="outline" className="text-xs h-5 border-blue-200 text-blue-600">Goal</Badge>}
            {account.type === 'ASSET' && <Badge variant="outline" className="text-xs h-5 border-amber-200 text-amber-600">Asset</Badge>}
          </div>
          
          {isAsset && (
            <div className="text-sm text-muted-foreground flex gap-4 mt-1">
              <span>Qty: {quantity} {unit}</span>
              <span className={realizedProfit >= 0 ? 'text-success' : 'text-destructive'}>
                Profit: {formatCurrency(realizedProfit)}
              </span>
            </div>
          )}
        </div>
        <div className='flex items-center gap-4'>
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(account.balance)}</p>
            {isAsset && <p className="text-xs text-muted-foreground">Est. Value</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isArchived && (
                  <>
                    <DropdownMenuItem onClick={() => handleEdit(account)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAccountToClose(account)}>
                        <Archive className="mr-2 h-4 w-4" />
                        Close Account
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setAccountToDelete(account)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
            <p className="text-muted-foreground">Manage your liquid cash, savings, and assets.</p>
        </div>
        <Button onClick={handleCreate}>Create Account</Button>
      </div>

      <AccountDrawer
        open={open}
        onOpenChange={setOpen}
        account={selectedAccount}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to <strong>permanently delete</strong> the account <strong>{accountToDelete?.name}</strong>? 
              This will remove all transaction history associated with it. 
              <br/><br/>
              To preserve history, use <strong>Close Account</strong> instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Dialog */}
      <AlertDialog open={!!accountToClose} onOpenChange={(open) => !open && setAccountToClose(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close <strong>{accountToClose?.name}</strong>?
              <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>It will be hidden from your active list.</li>
                  <li>You cannot select it for new transactions.</li>
                  <li><strong>Balance must be 0</strong> to close it.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseConfirm}>
              Close Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SECTION 1: SPENDING & CASH */}
      <div className="space-y-4">
        <div className="flex items-end justify-between border-b pb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                💳 Spending & Cash
                <span className="text-sm font-normal text-muted-foreground">({liquidAccounts.length})</span>
            </h2>
            <div className="text-right">
                <span className="text-sm text-muted-foreground block">Total Available</span>
                <span className="text-xl font-bold">{formatCurrency(liquidTotal)}</span>
            </div>
        </div>
        
        <div className="space-y-2">
            {liquidAccounts.length > 0 ? (
                liquidAccounts.map(account => <AccountCard key={account._id} account={account} />)
            ) : (
                <p className="text-sm text-muted-foreground italic py-4">No cash accounts found.</p>
            )}
        </div>
      </div>

      {/* SECTION 2: SAVINGS & ASSETS */}
      <div className="space-y-4">
        <div className="flex items-end justify-between border-b pb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                💰 Savings & Assets
                <span className="text-sm font-normal text-muted-foreground">({specialAccounts.length})</span>
            </h2>
            <div className="text-right">
                <span className="text-sm text-muted-foreground block">Total Value</span>
                <span className="text-xl font-bold">{formatCurrency(specialTotal)}</span>
            </div>
        </div>

        <div className="space-y-2">
            {specialAccounts.length > 0 ? (
                specialAccounts.map(account => <AccountCard key={account._id} account={account} />)
            ) : (
                <p className="text-sm text-muted-foreground italic py-4">No savings or assets found.</p>
            )}
        </div>
      </div>

      {/* SECTION 3: CLOSED ACCOUNTS */}
      {archivedAccounts.length > 0 && (
          <Collapsible open={showClosed} onOpenChange={setShowClosed} className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full flex justify-between p-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                        <span className="flex items-center gap-2">
                            {showClosed ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            Closed Accounts ({archivedAccounts.length})
                        </span>
                        <div className="h-px bg-border flex-1 ml-4" />
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-2">
                {archivedAccounts.map(account => <AccountCard key={account._id} account={account} />)}
            </CollapsibleContent>
          </Collapsible>
      )}

    </div>
  )
}
