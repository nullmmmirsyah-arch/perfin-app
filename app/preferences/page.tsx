'use client'

import { PageHeader } from '@/components/PageHeader'
import { ThemeTogglePreferences } from '@/components/ThemeTogglePreferences'
import { PushNotificationSettings } from '@/components/PushNotificationSettings'
import { TimezoneSettings } from '@/components/TimezoneSettings'
import { Globe } from 'lucide-react'

export default function PreferencesPage() {
  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 space-y-6">
      <PageHeader
        title="Preferences"
        description="Atur tampilan dan notifikasi kamu"
      />

      <div className="space-y-4 max-w-xl">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Tampilan</h2>
          <ThemeTogglePreferences />
          <p className="text-xs text-muted-foreground">
            Pilih tema tampilan aplikasi
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Timezone</h2>
          </div>
          <TimezoneSettings />
          <p className="text-xs text-muted-foreground">
            Tentukan timezone untuk budget period kamu
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Notifikasi</h2>
          <PushNotificationSettings />
          <p className="text-xs text-muted-foreground">
            Terima notifikasi ke perangkat
          </p>
        </div>
      </div>
    </div>
  )
}
