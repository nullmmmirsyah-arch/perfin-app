import { formatCurrency } from '@/lib/utils'

export function getAllocationNudge(
  percent: number,
  remaining: number
): { message: string; variant: 'default' | 'success' | 'warning' } {
  if (percent < 0) {
    return {
      message: `Over-allocated by ${formatCurrency(Math.abs(remaining))}. Move funds to fix.`,
      variant: 'warning',
    }
  }
  if (percent === 0) {
    return {
      message: 'Start assigning your income to categories.',
      variant: 'default',
    }
  }
  if (percent < 50) {
    return {
      message: `Great start! ${formatCurrency(remaining)} still needs a home.`,
      variant: 'default',
    }
  }
  if (percent < 80) {
    return {
      message: `Almost halfway! Just ${formatCurrency(remaining)} left.`,
      variant: 'default',
    }
  }
  if (percent < 100) {
    return {
      message: `So close! ${formatCurrency(remaining)} to reach zero-based.`,
      variant: 'default',
    }
  }
  return {
    message: 'Every rupiah has a job!',
    variant: 'success',
  }
}
