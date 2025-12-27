'use client';

import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export function PushNotificationSettings() {
  const { isSubscribed, permission, subscribeUser, unsubscribeUser } = usePushNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      if (checked) {
        if (permission === 'denied') {
            toast.error('Notifications are blocked. Please enable them in your browser settings.');
            return; 
        }
        await subscribeUser();
        toast.success('Notifications enabled');
      } else {
        await unsubscribeUser();
        toast.success('Notifications disabled');
      }
    } catch (error) {
      toast.error(checked ? 'Failed to enable notifications' : 'Failed to disable notifications');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || permission === 'denied';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Push Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Manage how you receive alerts and updates from Perfin on this device.
        </p>
      </div>
      
      <div className="flex items-center justify-between rounded-lg border p-4 bg-card">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {isSubscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            <label htmlFor="push-mode" className="text-base font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Enable Notifications
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            Receive real-time updates about your transactions and budgets.
          </p>
        </div>
        <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              id="push-mode"
              checked={isSubscribed}
              onCheckedChange={handleToggle}
              disabled={isDisabled}
            />
        </div>
      </div>
      
      {permission === 'denied' && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          Notifications are currently blocked by your browser. Please reset permissions in your browser settings to enable them.
        </div>
      )}
    </div>
  );
}
