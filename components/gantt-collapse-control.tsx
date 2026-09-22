'use client';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

export default function GanttCollapseControl({
  groupIds,
  collapsed,
  setCollapsed,
  disabled = false,
  subject = '项目任务',
}: {
  groupIds: string[];
  collapsed: string[];
  setCollapsed: Dispatch<SetStateAction<string[]>>;
  disabled?: boolean;
  subject?: string;
}) {
  const allCollapsed =
    groupIds.length > 0 && groupIds.every((id) => collapsed.includes(id));
  const label = allCollapsed ? '展开全部' : '折叠全部';
  return (
    <button
      type="button"
      className="subtle toolbar-icon-control"
      title={label + subject}
      aria-label={label + subject}
      disabled={disabled || groupIds.length === 0}
      onClick={() =>
        setCollapsed((ids) =>
          allCollapsed
            ? ids.filter((id) => !groupIds.includes(id))
            : [...new Set([...ids, ...groupIds])],
        )
      }
    >
      {allCollapsed ? <ChevronsUpDown size={16} aria-hidden="true" /> : <ChevronsDownUp size={16} aria-hidden="true" />}
    </button>
  );
}
