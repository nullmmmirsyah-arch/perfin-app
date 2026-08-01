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
import { MoreHorizontal as MoreIcon, Trash2 as TrashIcon, Edit as EditIcon } from '@/components/ui/icons'
import MerchantDrawer from '@/components/MerchantDrawer'
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

export default function MerchantsPage() {
  const [open, setOpen] = useState(false)
  const [selectedMerchant, setSelectedMerchant] = useState<Doc<'merchants'> | undefined>(undefined)
  const [merchantToDelete, setMerchantToDelete] = useState<Doc<'merchants'> | undefined>(undefined)

  const { householdId } = useHousehold()
  const canCreate = true

  const merchants = useQuery(api.merchants.get, { householdId: householdId ?? undefined })
  const deleteMerchant = useMutation(api.merchants.deleteMerchant)

  const handleCreate = () => {
    setSelectedMerchant(undefined)
    setOpen(true)
  }

  const handleEdit = (merchant: Doc<'merchants'>) => {
    setSelectedMerchant(merchant)
    setOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (merchantToDelete) {
      try {
        await deleteMerchant({ id: merchantToDelete._id })
        toast.success("Merchant deleted")
        setMerchantToDelete(undefined)
      } catch {
        toast.error("Failed to delete merchant")
        setMerchantToDelete(undefined)
      }
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Merchants</h1>
        {canCreate && <Button onClick={handleCreate}>Create Merchant</Button>}
      </div>

      <MerchantDrawer
        open={open}
        onOpenChange={setOpen}
        merchant={selectedMerchant}
      />

      <AlertDialog open={!!merchantToDelete} onOpenChange={(open) => !open && setMerchantToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Merchant?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the merchant <strong>{merchantToDelete?.name}</strong>? 
              This will permanently remove the merchant.
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
        {merchants === undefined ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 bg-muted rounded" />
                    <div className="h-4 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-8 w-8 bg-muted rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {merchants.map(merchant => (
              <Card key={merchant._id} className="p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center gap-2">
                  {merchant.icon.startsWith('http') ? (
                    <img src={merchant.icon} alt="" className="w-10 h-10" />
                  ) : merchant.icon.length <= 2 && !merchant.icon.includes(':') ? (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-medium text-primary">{merchant.icon}</span>
                    </div>
                  ) : (
                    <div className="text-4xl">{merchant.icon}</div>
                  )}
                  <p className="font-medium text-center truncate w-full">{merchant.name}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(merchant)}>
                        <EditIcon className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setMerchantToDelete(merchant)}
                      >
                        <TrashIcon className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
            {merchants.length === 0 && (
              <div className="col-span-full p-4 border rounded-md bg-muted/50 text-center">
                <p className="text-muted-foreground">No merchants yet. Create one to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
