"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import webpush from "web-push";

interface Subscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const sendNotification = internalAction({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Ambil data langganan user dari database (menggunakan query internal)
    const subscriptions = (await ctx.runQuery(internal.notifications.getSubscriptions, {
      userId: args.userId,
    })) as Subscription[];

    // 2. Siapkan konfigurasi Web Push
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const webPushEmail = process.env.WEB_PUSH_EMAIL || "mailto:admin@perfin.app";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not set. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Convex Dashboard.");
      return;
    }

    webpush.setVapidDetails(webPushEmail, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
    });

    // 3. Kirim notifikasi ke semua device user secara paralel
    const results = await Promise.allSettled(
      subscriptions.map((sub: Subscription) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        )
      )
    );

    // 4. Log hasil pengiriman
    results.forEach((result: PromiseSettledResult<webpush.SendResult>, index: number) => {
      if (result.status === "rejected") {
        console.error(`Gagal mengirim ke device ${subscriptions[index].endpoint}:`, result.reason);
        // Optional: Di sini bisa ditambahkan logika untuk menghapus subscription yang sudah invalid (404/410)
      } else {
        console.log(`Sukses mengirim ke device ${subscriptions[index].endpoint}`);
      }
    });
  },
});
