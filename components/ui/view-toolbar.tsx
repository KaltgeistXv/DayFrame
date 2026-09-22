import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Shared toolbar geometry. Labels and actions stay with their owning view. */
export function ViewToolbar({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="view-toolbar" className={cn('view-toolbar', className)} {...props} />;
}
