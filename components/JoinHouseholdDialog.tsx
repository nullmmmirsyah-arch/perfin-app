'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useHousehold } from './HouseholdProvider'

export function JoinHouseholdDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  const acceptInvite = useMutation(api.households.acceptInvite)
  const { selectHousehold } = useHousehold()

  const handleJoin = async () => {
    if (!code) return;
    setIsLoading(true)
    try {
      const householdId = await acceptInvite({ code: code.toUpperCase() })
      toast.success("Joined household successfully!")
      selectHousehold(householdId)
      onOpenChange(false)
      setCode("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to join household")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Join Household</DialogTitle>
          <DialogDescription>Enter the 6-character invite code shared with you.</DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
            <div className="grid gap-2">
                <Label htmlFor="code">Invite Code</Label>
                <Input 
                    id="code" 
                    placeholder="ABC123" 
                    value={code} 
                    onChange={(e) => setCode(e.target.value)}
                    className="uppercase tracking-widest font-mono text-center text-lg"
                    maxLength={6}
                />
            </div>
        </div>

        <DialogFooter>
            <Button onClick={handleJoin} disabled={isLoading || code.length < 6}>
                {isLoading ? "Joining..." : "Join Household"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
