'use client';
import { useSyncExternalStore } from 'react';
import { ListChecks } from 'lucide-react';
import { DateStepControls } from './ui/date-step-controls';
import DateNavigator from '@/components/date-navigator';

export const GANTT_CELL_WIDTH = 60;

export function GanttDateControls({
  value,
  today,
  onChange,
  onMove,
  disabled = false,
}: {
  value: string;
  today: string;
  onChange: (date: string) => void;
  onMove: (days: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="gantt-date-controls">
      <DateNavigator value={value} onChange={onChange} />
      <DateStepControls
        previousLabel="上一时段" nextLabel="下一时段" disabled={disabled} iconSize={15}
        onPrevious={() => onMove(-7)} onCurrent={() => onChange(today)} onNext={() => onMove(7)}
      />
    </div>
  );
}

export function GanttHeader({
  dates,
  today,
  label,
}: {
  dates: string[];
  today: string;
  label: string;
}) {
  const months: { date: string; start: number; count: number }[] = [];
  dates.forEach((date, index) => {
    const last = months.at(-1);
    if (last && last.date.slice(0, 7) === date.slice(0, 7)) last.count++;
    else months.push({ date, start: index, count: 1 });
  });
  return (
    <div className="gantt-header">
      <div className="gantt-header-scale">
      <div className="gantt-row gantt-months">
        <span className="gantt-header-label">{label}</span>
        {months.map((month) => (
          <span
            key={month.date}
            className="gantt-month-label"
            style={{ gridColumn: `${month.start + 2} / span ${month.count}` }}
          >
            <b>
              {month.date.slice(0, 4)}年{Number(month.date.slice(5, 7))}月
            </b>
          </span>
        ))}
      </div>
      <div className="gantt-row gantt-head">
        <span aria-hidden="true" />
        {dates.map((date) => {
          const weekday = new Date(date + 'T12:00:00').getDay();
          return (
            <span
              key={date}
              title={`${date} 星期${['日', '一', '二', '三', '四', '五', '六'][weekday]}`}
              className={
                (date === today ? 'gantt-today ' : '') +
                ([0, 6].includes(weekday) ? 'gantt-weekend' : '')
              }
            >
              <b>{Number(date.slice(8))}</b>
            </span>
          );
        })}
      </div>
      </div>
    </div>
  );
}


// Both Gantt views share the same session preference for secondary daily detail.
let detailVisible = false;
const detailListeners = new Set<() => void>();
const subscribeDetails = (listener: () => void) => {
  detailListeners.add(listener);
  return () => { detailListeners.delete(listener); };
};
export function useGanttDetails() {
  return useSyncExternalStore(subscribeDetails, () => detailVisible, () => false);
}
export function GanttDetailToggle() {
  const active = useGanttDetails();
  const label = active ? '隐藏打卡明细' : '显示打卡明细';
  return <button type="button" className="subtle toolbar-icon-control" aria-label={label} title={label} aria-pressed={active} data-filtered={active || undefined} onClick={() => {
    detailVisible = !detailVisible;
    detailListeners.forEach(listener => listener());
  }}><ListChecks size={16} /></button>;
}
