import type { LucideIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type EmptyStateProps = {
  icon?: LucideIcon;
  title?: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-4 gap-2' : 'py-8 gap-3'
    )}>
      {Icon && (
        <Icon className={cn(
          'text-muted-foreground',
          compact ? 'h-6 w-6' : 'h-10 w-10'
        )} />
      )}
      {title && (
        <h3 className={cn(
          'font-semibold text-foreground',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {title}
        </h3>
      )}
      <p className={cn(
        'text-muted-foreground max-w-[280px]',
        compact ? 'text-[10px]' : 'text-xs'
      )}>
        {description}
      </p>
      {action && (
        action.href ? (
          <Button variant="outline" size="sm" asChild className="mt-2">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick} className="mt-2">
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
