import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';

import { cn } from '@/lib/utils';
import { fieldControlClass } from './field-style';

function Input({
  className,
  type,
  variant = 'default',
  ...props
}: React.ComponentProps<'input'> & { variant?: 'default' | 'title' }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-variant={variant}
      className={cn(
        fieldControlClass,
        'h-[var(--ui-control-default)] w-full min-w-0 px-[var(--ui-control-padding)] py-1 transition-[border-color,box-shadow,background-color] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:pointer-events-none',
        variant === 'title' &&
          'text-[length:var(--ui-text-body)] font-normal text-foreground shadow-none',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
