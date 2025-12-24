'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Copy, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@clerk/nextjs'
import { useHousehold } from './HouseholdProvider'

export function HouseholdSettingsDialog({ householdId, open, onOpenChange }: { householdId: Id<"households">, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { user } = useUser()
  const { households } = useHousehold()
  const members = useQuery(api.households.getMembers, { householdId })
  const invites = useQuery(api.households.getPendingInvites, { householdId })
  const createInvite = useMutation(api.households.createInvite)
  const removeMember = useMutation(api.households.removeMember)
  const renameHousehold = useMutation(api.households.rename)

  const currentHousehold = households.find(h => h._id === householdId)
  const [name, setName] = useState(currentHousehold?.name || "")
  const [inviteEmail, setInviteEmail] = useState("")

  const handleRename = async () => {
    try {
      await renameHousehold({ householdId, name })
      toast.success("Household renamed")
    } catch (e) {
      toast.error("Failed to rename")
    }
  }

  const handleCreateInvite = async () => {
    try {
      const code = await createInvite({ householdId, email: inviteEmail || undefined })
      toast.success(`Invite created! Code: ${code}`)
      setInviteEmail("")
    } catch (e) {
      toast.error("Failed to create invite")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const handleRemoveMember = async (userId: string) => {
      if(!confirm("Are you sure you want to remove this member?")) return;
      try {
          await removeMember({ householdId, userId })
          toast.success("Member removed")
      } catch(e) {
          toast.error("Failed to remove member")
      }
  }

  const isAdmin = members?.find(m => m.userId === user?.id)?.role === 'admin'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Household Settings</DialogTitle>
          <DialogDescription>Manage members and invites for this household.</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invites">Invites</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
             <div className="grid gap-2">
                <Label htmlFor="name">Household Name</Label>
                <div className="flex gap-2">
                    <Input 
                        id="name"
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="e.g. My Family"
                    />
                    <Button onClick={handleRename} disabled={!isAdmin}>Update</Button>
                </div>
                {!isAdmin && <p className="text-xs text-muted-foreground">Only admins can rename the household.</p>}
             </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
             <Table>
                 <TableHeader>
                     <TableRow>
                         <TableHead>User</TableHead>
                         <TableHead>Role</TableHead>
                         <TableHead className="text-right">Action</TableHead>
                     </TableRow>
                 </TableHeader>
                 <TableBody>
                     {members?.map(member => (
                         <TableRow key={member._id}>
                             <TableCell>
                                 <div className="flex flex-col">
                                     <span className="font-medium">{member.email || "Unknown"}</span>
                                     <span className="text-xs text-muted-foreground">{member.userId === user?.id ? "(You)" : ""}</span>
                                 </div>
                             </TableCell>
                             <TableCell className="capitalize">{member.role}</TableCell>
                             <TableCell className="text-right">
                                 {isAdmin && member.userId !== user?.id && (
                                     <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.userId)}>
                                         <Trash2 className="h-4 w-4 text-destructive" />
                                     </Button>
                                 )}
                             </TableCell>
                         </TableRow>
                     ))}
                 </TableBody>
             </Table>
          </TabsContent>
          
          <TabsContent value="invites" className="space-y-4">
             {isAdmin ? (
                 <>
                    <div className="flex items-end gap-2">
                        <div className="grid gap-1 flex-1">
                            <Label htmlFor="email">Email (Optional)</Label>
                            <Input 
                                id="email" 
                                placeholder="friend@example.com" 
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleCreateInvite}>
                            <Plus className="mr-2 h-4 w-4" /> Generate Code
                        </Button>
                    </div>
                    
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>For Email</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invites?.map(invite => (
                                    <TableRow key={invite._id}>
                                        <TableCell className="font-mono font-bold tracking-widest">{invite.code}</TableCell>
                                        <TableCell>{invite.email || "Anyone"}</TableCell>
                                        <TableCell>{new Date(invite.expiresAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(invite.code)}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {invites?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                            No pending invites.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                 </>
             ) : (
                 <div className="p-8 text-center text-muted-foreground">
                     Only admins can manage invites.
                 </div>
             )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
