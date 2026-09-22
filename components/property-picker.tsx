'use client';
import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from '@/components/ui/select';
export default function Picker({
  label,
  value,
  onChange,
  options,
  createOption,
  detail = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
  createOption?: { label: string; onSelect: () => void };
  detail?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === '__create-option__') createOption?.onSelect();
        else if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger aria-label={label} className="picker">
        <SelectValue>
          {options.find(([v]) => v === value)?.[1] || label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className={detail ? 'task-detail-property-popover' : undefined}
        side="bottom"
        align="start"
        alignItemWithTrigger={false}
        sideOffset={4}
      >
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
        {createOption && (
          <SelectItem value="__create-option__" className="ui-picker-create">
            <Plus size={16} aria-hidden="true" />
            {createOption.label}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
