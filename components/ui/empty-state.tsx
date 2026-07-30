import type { LucideIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type EmptyStateProps = {
  icon?: LucideIcon;
  title?: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  variant?: 'default' | 'compact' | 'illustrated';
  /** @deprecated Use `variant="compact"` instead */
  compact?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, variant, compact }: EmptyStateProps) {
  const resolvedVariant = variant ?? (compact ? 'compact' : 'default');
  const isCompact = resolvedVariant === 'compact';
  const isIllustrated = resolvedVariant === 'illustrated';

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      isCompact ? 'py-4 gap-2' : isIllustrated ? 'py-12 gap-4' : 'py-8 gap-3'
    )}>
      {Icon && (
        <Icon className={cn(
          'text-muted-foreground',
          isCompact ? 'h-6 w-6' : isIllustrated ? 'h-16 w-16 opacity-40' : 'h-10 w-10'
        )} />
      )}
      {title && (
        <h3 className={cn(
          'font-semibold text-foreground',
          isCompact ? 'text-xs' : isIllustrated ? 'text-lg' : 'text-sm'
        )}>
          {title}
        </h3>
      )}
      <p className={cn(
        'text-muted-foreground max-w-[280px]',
        isCompact ? 'text-[10px]' : 'text-xs'
      )}>
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {action && (
            action.href ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
