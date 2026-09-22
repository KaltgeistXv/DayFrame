'use client';
import { uiCopy } from '@/lib/ui-copy';
import { useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { zhCN } from 'date-fns/locale';
import { day } from '@/lib/model';

export default function DateNavigator({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(new Date(value + 'T12:00:00'));
  const select = (date: string) => {
    if (!date) return;
    onChange(date);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setMonth(new Date(value + 'T12:00:00'));
          setDraft(value);
        }
      }}
    >
      <PopoverTrigger
        className="date-navigator"
        aria-label={`选择日期，当前 ${value}`}
      >
        {Number(value.slice(0, 4))}年{Number(value.slice(5, 7))}月
        {Number(value.slice(8))}日
        <ChevronDown size={14} />
      </PopoverTrigger>
      <PopoverContent className="date-navigation-popup" align="start">
        <form
          className="date-navigation-form"
          onSubmit={(e) => {
            e.preventDefault();
            select(draft);
          }}
        >
          <label className="date-navigation-input">
            {uiCopy.chooseDate}<input
              type="date"
              required
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button className="iconbtn" type="submit" aria-label="跳转到所选日期">
            <ArrowRight size={15} />
          </button>
        </form>
        <Calendar
          locale={zhCN}
          formatters={{
            formatCaption: (date) =>
              `${date.getFullYear()}年${date.getMonth() + 1}月`,
          }}
          weekStartsOn={1}
          mode="single"
          selected={new Date(value + 'T12:00:00')}
          month={month}
          onMonthChange={setMonth}
          onSelect={(date) => date && select(day(date))}
        />
      </PopoverContent>
    </Popover>
  );
}
