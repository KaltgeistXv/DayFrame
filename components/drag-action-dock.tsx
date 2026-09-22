'use client';
import { uiCopy } from '@/lib/ui-copy';
import { useState, type DragEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { CalendarMinus, Trash2 } from 'lucide-react';
type Action = 'unplan' | 'delete';
export default function DragActionDock({ onDrop, active, deleteRef, disabled = false }: {
 onDrop?: (action: Action, event: DragEvent<HTMLDivElement>) => void;
 active?: Action | null; deleteRef?: Ref<HTMLDivElement>; disabled?: boolean;
}) {
 const [hover, setHover] = useState<Action | null>(null);
 return createPortal(<div className="drag-action-dock" aria-label="拖动任务操作">
 {(['unplan', 'delete'] as const).map(action => <div key={action}
 ref={action === 'delete' ? deleteRef : undefined} className="drag-action-target"
 data-action={action} data-active={(active ?? hover) === action || undefined}
 data-task-unplan={action === 'unplan' ? '' : undefined}
 data-schedule-drop={action === 'unplan' ? 'unplanned' : undefined}
 data-task-delete={action === 'delete' ? '' : undefined}
 onDragOver={event => { if (disabled || !onDrop || !event.dataTransfer.types.includes('text/plain')) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setHover(action); }}
 onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHover(null); }}
 onDrop={event => { if (disabled || !onDrop) return; event.preventDefault(); event.stopPropagation(); setHover(null); onDrop(action,event); }}>
 {action === 'unplan' ? <CalendarMinus size={18} /> : <Trash2 size={18} />}
 <span><strong>{action === 'unplan' ? uiCopy.cancelSchedule : uiCopy.deleteTask}</strong><small>{action === 'unplan' ? uiCopy.cancelScheduleHint : uiCopy.releaseDelete}</small></span>
 </div>)}
 </div>,document.body);
}
