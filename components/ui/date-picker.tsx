'use client';

import { uiCopy } from '@/lib/ui-copy';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { zhCN } from 'date-fns/locale';

import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function serializeDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const date = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function displayDate(value?: string) {
  return value ? value.replaceAll('-', '/') : '';
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  clearable = false,
  placeholder = uiCopy.chooseDate,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const selected = useMemo(() => parseDate(value), [value]);
  const minDate = useMemo(() => parseDate(min), [min]);
  const maxDate = useMemo(() => parseDate(max), [max]);
  const [todayValue, setTodayValue] = useState(() => serializeDate(new Date()));
  const todayUnavailable =
    (!!min && todayValue < min) || (!!max && todayValue > max);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(
    selected || minDate || maxDate || new Date(),
  );

  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout>;
    function refreshToday() {
      const now = new Date();
      setTodayValue(serializeDate(now));
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refreshToday, midnight.getTime() - now.getTime());
    }
    refreshToday();
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setMonth(selected || minDate || maxDate || new Date());
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger
        type="button"
        className={cn('picker shared-date-picker-trigger', className)}
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        aria-required={required || undefined}
        aria-expanded={open}
      >
        <span data-placeholder={!value || undefined}>
          {displayDate(value) || placeholder}
        </span>
        <CalendarDays size={15} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        className="shared-date-picker-popover"
        align="start"
        sideOffset={4}
      >
        <Calendar
          locale={zhCN}
          weekStartsOn={1}
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          formatters={{
            formatCaption: (date) =>
              `${date.getFullYear()}年${date.getMonth() + 1}月`,
          }}
          disabled={(date) =>
            (!!minDate && date < minDate) || (!!maxDate && date > maxDate)
          }
          onSelect={(date) => {
            if (!date) return;
            onChange(serializeDate(date));
            setOpen(false);
          }}
        />
        <div className="shared-date-picker-actions">
          {clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              清除
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={todayUnavailable}
            onClick={() => {
              const currentToday = serializeDate(new Date());
              setTodayValue(currentToday);
              if ((min && currentToday < min) || (max && currentToday > max))
                return;
              onChange(currentToday);
              setOpen(false);
            }}
          >
            今天
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
