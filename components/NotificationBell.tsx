'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Doc, Id } from '../convex/_generated/dataModel'
import { Bell, Check, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useHousehold } from './HouseholdProvider'
import GoalAchievementDialog from './GoalAchievementDialog'
import { formatDistanceToNow } from 'date-fns'

export default function NotificationBell() {
  const { householdId } = useHousehold()
  
  // Use polling or subscription? useQuery is reactive.
  const unreadCount = useQuery(api.notifications.getUnreadCount, { householdId: householdId ?? undefined }) || 0
  const notifications = useQuery(api.notifications.get, { householdId: householdId ?? undefined })
  
  const markRead = useMutation(api.notifications.markAsRead)
  const markAllRead = useMutation(api.notifications.markAllAsRead)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedGoalNotif, setSelectedGoalNotif] = useState<Doc<"notifications"> | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const handleDialogOpenChange = (open: boolean) => {
      setDialogOpen(open)
      if (!open) {
          // Delay clearing so the closing animation can finish without immediate unmount if needed,
          // though immediate is usually fine for Shadcn dialogs.
          setTimeout(() => setSelectedGoalNotif(null), 200);
      }
  }

  const handleNotificationClick = async (notification: Doc<"notifications">) => {
    if (notification.type === 'goal_reached' && notification.data?.categoryId) {
        setSelectedGoalNotif(notification)
        setDialogOpen(true)
        setPopoverOpen(false) // Close popover
        // Don't mark as read yet, let dialog handle it or user might lose the entry if they cancel dialog
    } else {
        await markRead({ id: notification._id })
    }
  }

  const handleMarkAllRead = async () => {
      await markAllRead({ householdId: householdId ?? undefined })
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-[1.2rem] flex items-center justify-center text-[10px]"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <h4 className="font-semibold">Notifications</h4>
            {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-auto text-xs text-muted-foreground p-0" onClick={handleMarkAllRead}>
                    Mark all read
                </Button>
            )}
          </div>
          <ScrollArea className="h-[300px]">
            {notifications === undefined ? (
               <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : notifications.length === 0 ? (
               <div className="p-8 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
                <div className="divide-y">
                    {notifications.map((notif) => (
                        <div 
                            key={notif._id} 
                            className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                        >
                            <div className="flex gap-3">
                                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!notif.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium leading-none">{notif.title}</p>
                                        {notif.type === 'goal_reached' && <PartyPopper className="h-3 w-3 text-yellow-500" />}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{notif.message}</p>
                                    <p className="text-xs text-muted-foreground pt-1">
                                        {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedGoalNotif && selectedGoalNotif.data?.categoryId && (
          <GoalAchievementDialog 
            open={dialogOpen} 
            onOpenChange={handleDialogOpenChange}
            categoryId={selectedGoalNotif.data.categoryId as Id<"categories">}
            notificationId={selectedGoalNotif._id}
          />
      )}
    </>
  )
}
