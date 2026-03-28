'use client';

import { cn } from '@/lib/utils';
import { BarChart3, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ViewMode = 'table' | 'chart';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-muted rounded-lg', className)}>
      <Button
        variant={value === 'table' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onChange('table')}
        className={cn(
          'h-8 px-3 gap-2',
          value === 'table' && 'bg-background shadow-sm'
        )}
      >
        <Table2 className="h-4 w-4" />
        <span className="hidden sm:inline">Table</span>
      </Button>
      <Button
        variant={value === 'chart' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onChange('chart')}
        className={cn(
          'h-8 px-3 gap-2',
          value === 'chart' && 'bg-background shadow-sm'
        )}
      >
        <BarChart3 className="h-4 w-4" />
        <span className="hidden sm:inline">Chart</span>
      </Button>
    </div>
  );
}
