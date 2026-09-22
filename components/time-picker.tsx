'use client';
import { Clock3 } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select';
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, '0'),
);
export default function TimePicker({
  value,
  onChange,
  disabled,
  'aria-label': label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-label': string;
}) {
  const [hour = '00', minute = '00'] = value.split(':');
  return (
    <fieldset className="precise-time-picker" aria-label={label}>
      <Clock3 size={16} aria-hidden="true" />
      <Select
        value={hour}
        disabled={disabled}
        onValueChange={(v) => {
          if (v !== null) onChange(`${v}:${minute}`);
        }}
      >
        <SelectTrigger aria-label={`${label} · 小时`}>
          <SelectValue>{hour}</SelectValue>
        </SelectTrigger>
        <SelectContent className="precise-time-options">
          {hours.map((v) => (
            <SelectItem key={v} value={v}>
              {v} 时
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span aria-hidden="true">:</span>
      <Select
        value={minute}
        disabled={disabled}
        onValueChange={(v) => {
          if (v !== null) onChange(`${hour}:${v}`);
        }}
      >
        <SelectTrigger aria-label={`${label} · 分钟`}>
          <SelectValue>{minute}</SelectValue>
        </SelectTrigger>
        <SelectContent className="precise-time-options">
          {minutes.map((v) => (
            <SelectItem key={v} value={v}>
              {v} 分
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </fieldset>
  );
}
