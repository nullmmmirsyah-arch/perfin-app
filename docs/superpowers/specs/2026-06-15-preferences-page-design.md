# Preferences Page — Design Spec

## Problem

Theme toggle (dark/light/system) and push notification settings are buried in the header dropdown and UserButton profile page. There's no dedicated, unified preferences page accessible from both mobile and desktop.

## Solution

Create a new `/preferences` route with a clean preferences page. Accessible from the SettingsSheet (mobile gear) and the sidebar (desktop).

---

### Section 1: Route & Navigation

- **New file:** `app/preferences/page.tsx`
- **Sidebar** (`components/Sidebar.tsx`): add "Preferences" link with `Settings` icon, after Labels
- **SettingsSheet** (`components/SettingsSheet.tsx`): add "Preferences" link to the settings links list

---

### Section 2: Preferences Page Content

Layout:
- Page title "Preferences" with description "Atur tampilan dan notifikasi kamu"
- Two cards stacked vertically

#### Card: Tampilan (Theme)
- Segmented control: `[ Light | Dark | System ]`
- Highlights the currently active option
- Calls `setTheme()` from `next-themes`'s `useTheme` hook
- Helper text: "Pilih tema tampilan aplikasi"

#### Card: Notifikasi (Notifications)
- Toggle switch for push notifications
- Uses `usePushNotifications` hook (`isSubscribed`, `subscribeUser`, `unsubscribeUser`, `permission`)
- When toggled on: calls `subscribeUser()`
- When toggled off: calls `unsubscribeUser()`
- Shows loading spinner during subscribe/unsubscribe
- Shows error alert if permission is denied
- Helper text: "Terima notifikasi ke perangkat"

---

### Section 3: Cleanup

- **ThemeToggle** removed from LayoutWrapper header (the component itself is reused on Preferences page)
- **NotificationBell** remains in LayoutWrapper header (different purpose: viewing notifications vs settings)
- **Push Settings tab** removed from Clerk's `<UserButton.UserProfilePage>` in LayoutWrapper (the PushNotificationSettings component or its logic is reused on the Preferences page)

---

## Files Changed

| File | Change |
|---|---|
| `app/preferences/page.tsx` | **Create** — preferences page |
| `components/Sidebar.tsx` | Add Preferences nav link |
| `components/SettingsSheet.tsx` | Add Preferences link |
| `components/LayoutWrapper.tsx` | Remove ThemeToggle from header; remove Push Settings tab from UserButton profile |
| `components/ThemeToggle.tsx` | Unchanged (reused on preferences page) |
| `components/PushNotificationSettings.tsx` | Unchanged (reused on preferences page) |

## Not Changed

- NotificationBell — stays in header
- All other pages and components
- Convex queries/mutations
