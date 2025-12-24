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
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, Edit } from 'lucide-react'
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

export default function AccountsPage() {
  const [open, setOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Doc<'accounts'> | undefined>(undefined)
  const [accountToDelete, setAccountToDelete] = useState<Doc<'accounts'> | undefined>(undefined)

  const { householdId } = useHousehold()
  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined })
  const deleteAccount = useMutation(api.accounts.deleteAccount)

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
      await deleteAccount({ id: accountToDelete._id })
      toast.success("Account deleted")
      setAccountToDelete(undefined)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Button onClick={handleCreate}>Create Account</Button>
      </div>

      <AccountDrawer
        open={open}
        onOpenChange={setOpen}
        account={selectedAccount}
      />

      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account <strong>{accountToDelete?.name}</strong>? 
              This will permanently remove the account and its balance.
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

      <div className="mt-8">
        <div className="space-y-2">
          {accounts?.map(account => {
            const isAsset = account.type === 'ASSET';
            const quantity = account.quantity ?? parseFloat(account.initialQuantity || '0');
            const unit = account.unit || '';
            const realizedProfit = account.totalRealizedProfit || 0;
            
            const formatCurrency = (val: string | number) => {
                const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
                return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(isNaN(num) ? 0 : num);
            };

            return (
            <Card key={account._id} className="p-4 flex flex-row justify-between items-center shadow-sm">
              <div>
                <p className="font-medium">{account.name}</p>
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
                    <DropdownMenuItem onClick={() => handleEdit(account)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
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
            );
          })}
          {accounts?.length === 0 && (
            <div className="p-4 border rounded-md bg-muted/50 text-center">
              <p className="text-muted-foreground">No accounts yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}