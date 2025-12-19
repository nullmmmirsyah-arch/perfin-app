'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, Edit } from 'lucide-react'
import AccountDrawer from '@/components/AccountDrawer'

export default function AccountsPage() {
  const [open, setOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Doc<'accounts'> | undefined>(undefined)

  const accounts = useQuery(api.accounts.get)
  const deleteAccount = useMutation(api.accounts.deleteAccount)

  const handleCreate = () => {
    setSelectedAccount(undefined)
    setOpen(true)
  }

  const handleEdit = (account: Doc<'accounts'>) => {
    setSelectedAccount(account)
    setOpen(true)
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

      <div className="mt-8">
        <div className="space-y-2">
          {accounts?.map(account => (
            <div key={account._id} className="p-4 border rounded-md flex justify-between items-center">
              <div>
                <p className="font-medium">{account.name}</p>
              </div>
              <div className='flex items-center gap-4'>
                <p className="font-semibold">{account.balance}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleEdit(account)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteAccount({ id: account._id })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
          {accounts?.length === 0 && (
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-muted-foreground">No accounts yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
