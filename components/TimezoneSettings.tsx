'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useHousehold } from '@/components/HouseholdProvider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Globe, Smartphone } from '@/components/ui/icons'

const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB (UTC+7)', desc: 'Jakarta, Bandung, Surabaya' },
  { value: 'Asia/Makassar', label: 'WITA (UTC+8)', desc: 'Makassar, Denpasar, Manado' },
  { value: 'Asia/Jayapura', label: 'WIT (UTC+9)', desc: 'Jayapura, Ambon, Ternate' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)', desc: 'Singapore, Kuala Lumpur' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)', desc: 'Tokyo, Osaka, Seoul' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)', desc: 'Shanghai, Beijing, Hong Kong' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)', desc: 'Dubai, Abu Dhabi' },
  { value: 'Europe/London', label: 'London (UTC+0/+1)', desc: 'London, Manchester' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)', desc: 'Paris, Berlin, Amsterdam' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)', desc: 'New York, Miami, Toronto' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)', desc: 'Chicago, Mexico City' },
  { value: 'America/Denver', label: 'Denver (UTC-7/-6)', desc: 'Denver, Phoenix' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)', desc: 'Los Angeles, San Francisco' },
] as const

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'Asia/Jakarta'
  }
}

function formatTimezoneLabel(tz: string): string {
  const found = TIMEZONES.find(t => t.value === tz)
  if (found) return found.label
  return tz.replace(/_/g, ' ').split('/').pop() || tz
}

export function TimezoneSettings() {
  const { households } = useHousehold()
  const updateSettings = useMutation(api.households.updateSettings)
  const [isSaving, setIsSaving] = useState(false)

  const activeHousehold = households[0]
  const timezoneMode = activeHousehold?.timezoneMode ?? 'device'
  const storedTimezone = activeHousehold?.timezone ?? 'Asia/Jakarta'
  const deviceTimezone = getDeviceTimezone()

  const effectiveTimezone = timezoneMode === 'device' ? deviceTimezone : storedTimezone

  const handleModeChange = async (mode: 'manual' | 'device') => {
    if (!activeHousehold) return
    setIsSaving(true)
    try {
      if (mode === 'device') {
        await updateSettings({
          householdId: activeHousehold._id,
          timezoneMode: 'device',
          timezone: deviceTimezone,
        })
      } else {
        await updateSettings({
          householdId: activeHousehold._id,
          timezoneMode: 'manual',
          timezone: storedTimezone,
        })
      }
      toast.success('Timezone updated')
    } catch {
      toast.error('Failed to update timezone')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTimezoneChange = async (tz: string) => {
    if (!activeHousehold) return
    setIsSaving(true)
    try {
      await updateSettings({
        householdId: activeHousehold._id,
        timezoneMode: 'manual',
        timezone: tz,
      })
      toast.success('Timezone updated')
    } catch {
      toast.error('Failed to update timezone')
    } finally {
      setIsSaving(false)
    }
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex rounded-lg border p-1 bg-muted/30 w-fit">
        <button
          onClick={() => handleModeChange('device')}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all',
            timezoneMode === 'device'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Smartphone className="h-3.5 w-3.5" />
          Device
        </button>
        <button
          onClick={() => handleModeChange('manual')}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all',
            timezoneMode === 'manual'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Globe className="h-3.5 w-3.5" />
          Manual
        </button>
      </div>

      {/* Current Timezone Display */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Active:</span>
          <span className="text-sm font-medium">{formatTimezoneLabel(effectiveTimezone)}</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {new Date().toLocaleTimeString('en-US', {
            timeZone: effectiveTimezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </span>
      </div>

      {/* Manual Picker */}
      {timezoneMode === 'manual' && (
        <div className="space-y-2">
          <Select value={storedTimezone} onValueChange={handleTimezoneChange} disabled={isSaving}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select Timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>
                  <div className="flex flex-col">
                    <span className="text-sm">{tz.label}</span>
                    <span className="text-[10px] text-muted-foreground">{tz.desc}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {timezoneMode === 'device' && (
        <p className="text-[10px] text-muted-foreground">
          Automatically uses your device timezone. Budget period transitions at midnight in your local time.
        </p>
      )}
    </div>
  )
}
