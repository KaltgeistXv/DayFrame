'use client';
import { ViewToolbar } from './ui/view-toolbar';
import type { ReactNode } from 'react';
import { DateStepControls } from './ui/date-step-controls';
import DateNavigator from './date-navigator';
export default function CalendarToolbar({
  date,
  period,
  onDate,
  onToday,
  onMove,
  children,
  toolbarStart,
  toolbarBelow,
}: {
  date: string;
  period: 'year' | 'month' | 'week' | 'day';
  onDate: (date: string) => void;
  onToday: () => void;
  onMove: (delta: number) => void;
  children?: ReactNode;
  toolbarStart?: ReactNode;
  toolbarBelow?: ReactNode;
}) {
  const unit = { year: '年', month: '个月', week: '周', day: '天' }[period];
  return (
    <div className="calendar-unified-toolbar">
      <ViewToolbar className="calendar-toolbar-actions">
        {toolbarStart}
        <DateNavigator value={date} onChange={onDate} />
        <DateStepControls
          previousLabel={'上一' + unit} nextLabel={'下一' + unit}
          onPrevious={() => onMove(-1)} onCurrent={onToday} onNext={() => onMove(1)}
        />
        {children}
      </ViewToolbar>
      {toolbarBelow}
    </div>
  );
}
