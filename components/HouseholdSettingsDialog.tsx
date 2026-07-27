'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Copy, Plus, User, Shield, Calendar, Users, Mail } from '@/components/ui/icons'
import { toast } from 'sonner'
import { useUser } from '@clerk/nextjs'
import { useHousehold } from './HouseholdProvider'
import { useIsMobile } from '@/hooks/use-mobile'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

export function HouseholdSettingsDialog({ householdId, open, onOpenChange }: { householdId: Id<"households">, open: boolean, onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Household Settings</DrawerTitle>
            <DrawerDescription>Manage preferences and members.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto">
             <SettingsContent householdId={householdId} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Household Settings</DialogTitle>
          <DialogDescription>Manage preferences and members.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 pb-6">
             <SettingsContent householdId={householdId} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function SettingsContent({ householdId }: { householdId: Id<"households"> }) {
  const { user } = useUser()
  const { households } = useHousehold()
  const members = useQuery(api.households.getMembers, { householdId })
  const invites = useQuery(api.households.getPendingInvites, { householdId })
  const createInvite = useMutation(api.households.createInvite)
  const removeMember = useMutation(api.households.removeMember)
  const updateSettings = useMutation(api.households.updateSettings)

  const currentHousehold = households.find(h => h._id === householdId)
  const [name, setName] = useState(currentHousehold?.name || "")
  const [budgetStartDay, setBudgetStartDay] = useState<string>("1")
  const [inviteEmail, setInviteEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (currentHousehold) {
        setName(currentHousehold.name)
        setBudgetStartDay(currentHousehold.budgetStartDay?.toString() || "1")
    }
  }, [currentHousehold])

  const handleUpdateSettings = async () => {
    setIsSubmitting(true)
    try {
      await updateSettings({ 
          householdId, 
          name,
          budgetStartDay: parseInt(budgetStartDay)
      })
      toast.success("Settings updated")
    } catch {
      toast.error("Failed to update")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateInvite = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const code = await createInvite({ householdId, email: inviteEmail || undefined })
      toast.success(`Invite created! Code: ${code}`)
      setInviteEmail("")
    } catch {
      toast.error("Failed to create invite")
    } finally {
        setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Code copied")
  }

  const handleRemoveMember = async (userId: string) => {
      if(!confirm("Are you sure? This cannot be undone.")) return;
      try {
          await removeMember({ householdId, userId })
          toast.success("Member removed")
      } catch {
          toast.error("Failed to remove member")
      }
  }

  const isAdmin = members?.find(m => m.userId === user?.id)?.role === 'admin'

  return (
    <div className="space-y-8">
       {/* 1. GENERAL SETTINGS */}
       <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <User className="h-4 w-4" />
              <h3>General</h3>
          </div>
          <div className="space-y-3 pl-1">
             <div className="grid gap-1.5">
                <Label htmlFor="name" className="text-xs text-muted-foreground">Household Name</Label>
                <div className="flex gap-2">
                    <Input 
                        id="name"
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        className="h-9"
                    />
                </div>
             </div>

             <div className="grid gap-1.5">
                <Label htmlFor="budgetStartDay" className="text-xs text-muted-foreground flex items-center gap-2">
                   <Calendar className="h-3 w-3" /> Budget Start Date
                </Label>
                <Select value={budgetStartDay} onValueChange={setBudgetStartDay} disabled={!isAdmin}>
                    <SelectTrigger id="budgetStartDay" className="h-9">
                        <SelectValue placeholder="Select Day" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                            <SelectItem key={day} value={day.toString()}>
                                Day {day} of month
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                    Current Cycle: {budgetStartDay}th - {parseInt(budgetStartDay) - 1 || 30}th
                </p>
             </div>

             {isAdmin && (
                <Button onClick={handleUpdateSettings} size="sm" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
             )}
          </div>
       </section>
       
       <Separator />

       {/* 2. MEMBERS */}
       <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Users className="h-4 w-4" />
              <h3>Members</h3>
          </div>
          
          <div className="space-y-3">
             {members?.map(member => (
                 <div key={member._id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                     <div className="flex items-center gap-3">
                         <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                             {(member.email?.[0] || "U").toUpperCase()}
                         </div>
                         <div>
                             <p className="text-sm font-medium leading-none">
                                {member.email || "Unknown User"}
                                {member.userId === user?.id && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
                             </p>
                             <div className="flex items-center gap-1 mt-1">
                                {member.role === 'admin' && <Shield className="h-3 w-3 text-amber-500" />}
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{member.role}</span>
                             </div>
                         </div>
                     </div>
                     
                     {isAdmin && member.userId !== user?.id && (
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMember(member.userId)}>
                             <Trash2 className="h-4 w-4" />
                         </Button>
                     )}
                 </div>
             ))}
          </div>
       </section>

       <Separator />

       {/* 3. INVITES */}
       <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Mail className="h-4 w-4" />
              <h3>Invites</h3>
          </div>

          {isAdmin ? (
             <div className="space-y-4">
                <div className="flex gap-2">
                    <Input 
                        placeholder="Email (Optional)" 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="h-9 text-sm"
                    />
                    <Button onClick={handleCreateInvite} size="sm" disabled={isSubmitting}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-2">
                    {invites?.map(invite => (
                        <div key={invite._id} className="flex items-center justify-between p-3 rounded-lg border border-dashed">
                             <div>
                                 <div className="flex items-center gap-2">
                                     <code className="text-sm font-bold tracking-wider bg-muted px-1.5 rounded">{invite.code}</code>
                                     <span className="text-xs text-muted-foreground">
                                         for {invite.email || "Anyone"}
                                     </span>
                                 </div>
                                 <p className="text-[10px] text-muted-foreground mt-1">
                                     Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                                 </p>
                             </div>
                             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(invite.code)}>
                                 <Copy className="h-4 w-4" />
                             </Button>
                        </div>
                    ))}
                    {invites?.length === 0 && (
                        <p className="text-xs text-center text-muted-foreground py-2">No active invites</p>
                    )}
                </div>
             </div>
          ) : (
             <div className="p-4 bg-muted/30 rounded-lg text-center">
                 <p className="text-xs text-muted-foreground">Only admins can invite new members.</p>
             </div>
          )}
       </section>
    </div>
  )
}