'use client';
import { uiCopy } from '@/lib/ui-copy';
import { displayDate } from '@/lib/calendar-date';
import { useId, useState } from 'react';
import type { Task, CheckIn, Project } from '@/lib/model';
import { checkInStats } from '@/lib/checkins';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import ProjectBadge from './project-badge';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { heatmapYear } from '@/lib/activity-heatmap';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';

function TaskCheckInHeatmap({
  task,
  date,
  maxDate,
  busy,
  onDate,
}: {
  task: Task;
  date: string;
  maxDate: string;
  busy: boolean;
  onDate: (date: string) => void;
}) {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : maxDate;
  const month = anchor.slice(0, 7);
  const dates = heatmapYear(Number(anchor.slice(0, 4))).filter((d) =>
    d?.startsWith(month),
  ) as string[];
  const offset = (new Date(`${dates[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  const records = new Map((task.checkins || []).map((c) => [c.date, c]));
  function move(delta: number) {
    const next = new Date(`${month}-01T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + delta);
    const value = next.toISOString().slice(0, 10);
    onDate(value > maxDate ? maxDate : value);
  }
  return (
    <section className="task-checkin-heatmap" aria-label="本任务打卡热力图">
      <header>
        <strong>
          {month.slice(0, 4)}年{Number(month.slice(5, 7))}月
        </strong>
        <button
          type="button"
          className="iconbtn"
          aria-label="查看上月打卡"
          disabled={busy || month === '0001-01'}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="查看下月打卡"
          disabled={busy || month >= maxDate.slice(0, 7)}
          onClick={() => move(1)}
        >
          <ChevronRight size={14} />
        </button>
      </header>
      <div className="task-checkin-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
          <small key={d}>{d}</small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {dates.map((d) => {
          const entry = records.get(d);
          return (
            <button
              type="button"
              key={d}
              disabled={busy || d > maxDate}
              data-recorded={!!entry}
              aria-pressed={date === d}
              aria-label={`${d}，${entry ? '已打卡' : '未打卡'}`}
              title={entry ? `${d}${entry.note ? ` · ${entry.note}` : ''}` : d}
              onClick={() => onDate(d)}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type Props = {
  task: Task;
  project?: Project;
  today: string;
  initialDate?: string;
  busy: boolean;
  onClose: () => void;
  onSave: (entry: CheckIn) => Promise<unknown>;
  onRemove: (date: string) => Promise<unknown>;
};
function EntryEditor({
  date,
  existing,
  busy,
  onSave,
  onRemove,
  completion = false,
}: {
  date: string;
  existing?: CheckIn;
  completion?: boolean;
  busy: boolean;
  onSave: Props['onSave'];
  onRemove: Props['onRemove'];
}) {
  const noteId = useId();
  const [note, setNote] = useState(existing?.note || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function save() {
    setError('');
    setSaved(false);
    try {
      await onSave({ date, note, minutes: existing?.minutes || 0 });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="checkin-fields">
      <label htmlFor={noteId}>
        进展
        <Textarea
          id={noteId}
          className="checkin-note-input"
          maxLength={2000}
          rows={3}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          placeholder="记录进展"
        />
      </label>
      {error && (
        <p role="alert" className="formerror">
          {error}
        </p>
      )}
      {saved && <output className="checkin-success">{uiCopy.checkInSaved}</output>}
      <div className="formfooter">
        {existing && !completion && (
          <Button
            type="button"
            variant="destructive-quiet"
            size="sm"
            disabled={busy}
            onClick={async () => {
              try {
                await onRemove(date);
                setNote('');
                setSaved(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Trash2 size={14} />
            {uiCopy.deleteRecord}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? uiCopy.saving : uiCopy.saveRecord}
        </Button>
      </div>
    </div>
  );
}
export function CheckInPanel(p: Omit<Props, 'onClose'>) {
  const maxDate =
    p.task.status === 'done' &&
    p.task.completedOn &&
    p.task.completedOn < p.today
      ? p.task.completedOn
      : p.today;
  const [date, setDate] = useState(p.initialDate || maxDate);
  const stats = checkInStats([p.task], p.today);
  const historyId = useId();
  return (
    <div className="checkin-editor checkin-panel">
      <h3 className="checkin-task-title">{p.task.title}</h3>
      <div className="checkin-summary" aria-label="打卡概览">
        <ProjectBadge project={p.project} />
        <dl>
          <div>
            <dt>已打卡</dt>
            <dd>{stats.days} 天</dd>
          </div>
        </dl>
      </div>
      <div className="checkin-layout">
        <TaskCheckInHeatmap
          task={p.task}
          date={date}
          maxDate={maxDate}
          busy={p.busy}
          onDate={setDate}
        />

        <section className="checkin-compose" aria-label="编辑当日打卡">
          <div className="checkin-date">
            <span>日期</span>
            <DatePicker
              required
              value={date}
              max={maxDate}
              disabled={p.busy}
              ariaLabel="日期"
              onChange={setDate}
            />
          </div>
          {date && date <= maxDate ? (
            <EntryEditor
              key={date}
              date={date}
              existing={p.task.checkins?.find((c) => c.date === date)}
              completion={
                p.task.status === 'done' && p.task.completedOn === date
              }
              busy={p.busy}
              onSave={p.onSave}
              onRemove={p.onRemove}
            />
          ) : (
            <output>
              {date > maxDate
                ? date > p.today
                  ? '不能为未来日期打卡'
                  : '任务已完成，该日期不可新增打卡'
                : '请选择有效日期'}
            </output>
          )}
        </section>
      </div>
      <div className="checkin-browse">
        <section className="checkin-history" aria-labelledby={historyId}>
          <h3 id={historyId}>历史记录</h3>
          {p.task.checkins?.length ? (
            [...p.task.checkins]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((c) => (
                <button
                  type="button"
                  key={c.date}
                  disabled={p.busy}
                  onClick={() => setDate(c.date)}
                  aria-pressed={date === c.date}
                  className={date === c.date ? 'active' : ''}
                >
                  <span>{displayDate(c.date)}</span>
                  <small>{c.note || '已打卡'}</small>
                </button>
              ))
          ) : (
            <p>{uiCopy.noRecords}</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default function CheckInDialog(p: Props) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !p.busy) p.onClose();
      }}
    >
      <DialogContent
        editorLayout="activity"
        className="editor checkin-editor standalone-checkin-dialog"
      >
        <DialogTitle>{uiCopy.checkInRecords}</DialogTitle>
        <DialogDescription className="sr-only">
          编辑和查看任务打卡记录。
        </DialogDescription>
        <CheckInPanel {...p} />
      </DialogContent>
    </Dialog>
  );
}
