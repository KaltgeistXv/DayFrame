import * as React from 'react';

import { cn } from '@/lib/utils';
import { fieldControlClass } from './field-style';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldControlClass,
        'flex min-h-20 w-full resize-none overflow-y-auto px-[var(--ui-control-padding)] py-[var(--ui-space-2)] leading-[var(--ui-line-normal)] transition-[border-color,box-shadow,background-color]',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
