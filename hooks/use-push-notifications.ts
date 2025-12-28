import { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const saveSubscription = useMutation(api.notifications.saveSubscription);
  const deleteSubscription = useMutation(api.notifications.deleteSubscription);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      setPermission(Notification.permission);
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, []);

  const subscribeUser = async () => {
    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID Public Key is missing');
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subscriptionJSON = subscription.toJSON();

      if (!subscriptionJSON.endpoint || !subscriptionJSON.keys) {
        throw new Error('Failed to generate subscription keys');
      }

      await saveSubscription({
        endpoint: subscriptionJSON.endpoint,
        keys: {
          p256dh: subscriptionJSON.keys.p256dh,
          auth: subscriptionJSON.keys.auth,
        },
        expirationTime: subscriptionJSON.expirationTime ? subscriptionJSON.expirationTime : undefined,
      });
      setIsSubscribed(true);
      setPermission(Notification.permission);
      console.log('User subscribed successfully');
    } catch (error) {
      console.error('Failed to subscribe user:', error);
      throw error;
    }
  };

  const unsubscribeUser = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 1. Unsubscribe from browser
        await subscription.unsubscribe();
        
        // 2. Remove from database
        await deleteSubscription({ endpoint: subscription.endpoint });
        
        setIsSubscribed(false);
        console.log('User unsubscribed successfully');
      }
    } catch (error) {
      console.error('Failed to unsubscribe user:', error);
      throw error;
    }
  };

  return { isSubscribed, permission, subscribeUser, unsubscribeUser };
}
