'use client';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function TaskDetailPropertyRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('task-property-row', className)}>
      <span className="task-property-label">{label}</span>
      <div className="task-property-value">{children}</div>
    </div>
  );
}

export default function TaskDetailSettingRow({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="task-property-row task-setting-row">
      <span className="task-property-label">{label}</span>
      <span className="task-property-value">
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </span>
    </label>
  );
}
