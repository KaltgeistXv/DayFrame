'use client';
import { uiCopy } from '@/lib/ui-copy';
import WorkspaceSettingsForm from './workspace-settings-form';
import { useId, useRef, useState } from 'react';
import type { Preferences } from '@/lib/model';
import { validateBackup, type Backup } from '@/lib/backup';
import { downloadBackup } from '@/lib/backup-download';
import { resetViewPreferences } from '@/lib/reset-view-preferences';
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
export default function InterfaceSettings({
  preferences,
  busy,
  onClose,
  save,
}: {
  preferences: Preferences;
  busy: boolean;
  onClose: () => void;
  save: (payload: unknown, message?: string) => Promise<unknown>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const [backup, setBackup] = useState<Backup | null>(null),
    [filename, setFilename] = useState(''),
    [mode, setMode] = useState('merge');
  const [importOpen, setImportOpen] = useState(false),
    [importBackupReady, setImportBackupReady] = useState(false),
    [resetBackupReady, setResetBackupReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const locked = busy || working;
  const [resetOpen, setResetOpen] = useState(false),
    [resetConfirmed, setResetConfirmed] = useState(false),
    [backupBeforeReset, setBackupBeforeReset] = useState(true);
  async function importData(backupFirst: boolean) {
    if (locked || !backup || (mode === 'replace' && !confirmed)) return;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      if (backupFirst) {
        const result = await downloadBackup();
        if (result === 'cancelled') {
          setMessage('已取消备份，未导入数据');
          return;
        }
        if (result === 'downloaded') {
          setImportBackupReady(true);
          setMessage('已开始下载备份，请确认保存完成后继续。');
          return;
        }
      }
      await save({ action: 'importWorkspace', mode, backup }, '数据导入完成');
      setBackup(null);
      setImportOpen(false);
      setImportBackupReady(false);
      setMessage('导入完成，已保留原计划和打卡日期');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <DialogContent
        editorLayout="settings"
        className="editor interface-editor"
      >
        <DialogTitle>设置</DialogTitle>
        <DialogDescription className="sr-only">
          管理工作空间和数据。
        </DialogDescription>
        <DialogBody className="backup-panel settings-content">
          <WorkspaceSettingsForm
            preferences={preferences}
            busy={locked}
            save={save}
          />
          <section className="dialog-action-section">
            <h3>{uiCopy.exportBackup}</h3>
            <p>保存全部数据和工作空间设置。</p>
            <Button
              variant="outline"
              size="sm"
              disabled={locked}
              onClick={async () => {
                setWorking(true);
                setError('');
                setMessage('');
                try {
                  const result = await downloadBackup();
                  setMessage(
                    result === 'saved'
                      ? '备份已保存'
                      : result === 'cancelled'
                        ? '已取消导出'
                        : '已开始下载备份，保存位置以浏览器设置为准。',
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setWorking(false);
                }
              }}
            >
              {uiCopy.exportBackup}
            </Button>
          </section>
          <section className="dialog-action-section">
            <h3>{uiCopy.importBackup}</h3>
            <p id={`${fieldId}-file-hint`}>
              使用 DayFrame 备份恢复数据，支持 JSON，最大 10 MB。
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={locked}
              aria-describedby={`${fieldId}-file-hint`}
              onClick={() => fileInput.current?.click()}
            >
              {filename ? uiCopy.reselectFile : uiCopy.chooseFile}
            </Button>
            <input
              ref={fileInput}
              hidden
              className="hidden"
              type="file"
              accept=".json,application/json"
              disabled={locked}
              aria-label={uiCopy.chooseBackupFile}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                // Allow selecting the same file again after a failed validation/import.
                e.target.value = '';
                if (!file) return;
                setResetOpen(false);
                setResetConfirmed(false);
                setResetBackupReady(false);
                setBackup(null);
                setImportOpen(false);
                setImportBackupReady(false);
                setError('');
                setMessage('');
                setConfirmed(false);
                setFilename('');
                setWorking(true);
                try {
                  if (file.size > 10 * 1024 * 1024)
                    throw Error('文件不能超过 10 MB');
                  const parsed = validateBackup(JSON.parse(await file.text()));
                  setBackup(parsed);
                  setFilename(file.name);
                } catch (e) {
                  setError(
                    e instanceof SyntaxError
                      ? '备份文件无法读取，请重新选择'
                      : (e as Error).message,
                  );
                } finally {
                  setWorking(false);
                }
              }}
            />
            {backup && (
              <div className="backup-preview dialog-action-details">
                <b>{filename}</b>
                <p>
                  {backup.data.tasks.length} 项任务 ·{' '}
                  {backup.data.projects.length} 个项目 ·{' '}
                  {backup.data.folders.length} 个文件夹 ·{' '}
                  {backup.data.labels.length} 个标签
                </p>
                <p>
                  {backup.data.tasks.reduce(
                    (n, t) => n + (t.checkins?.length || 0),
                    0,
                  )}{' '}
                  条打卡记录
                </p>
                <div className="settings-field">
                  <span>导入方式</span>
                  <Select
                    disabled={locked}
                    value={mode}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setMode(String(value));
                      setImportOpen(false);
                      setImportBackupReady(false);
                      setConfirmed(false);
                    }}
                  >
                    <SelectTrigger
                      aria-label="导入方式"
                      title={
                        mode === 'replace'
                          ? '用备份替换当前全部数据和设置。'
                          : '保留现有数据和设置，仅导入新增内容。'
                      }
                      className="backup-mode-select"
                    >
                      <SelectValue>
                        {mode === 'replace' ? '替换数据' : '合并备份'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="merge">合并备份</SelectItem>
                      <SelectItem value="replace">替换数据</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {mode === 'replace' && (
                  <label
                    className="backup-confirm"
                    htmlFor={`${fieldId}-replace`}
                  >
                    <Checkbox
                      id={`${fieldId}-replace`}
                      aria-label="确认用此备份替换当前全部数据"
                      disabled={locked}
                      checked={confirmed}
                      onCheckedChange={(checked) => {
                        setConfirmed(checked);
                        setImportOpen(false);
                        setImportBackupReady(false);
                      }}
                    />
                    <span>确认替换当前全部数据和设置</span>
                  </label>
                )}
                {!importOpen ? (
                  <Button
                    size="sm"
                    disabled={locked || (mode === 'replace' && !confirmed)}
                    onClick={() => {
                      setImportOpen(true);
                      setMessage('');
                      setError('');
                      setImportBackupReady(false);
                    }}
                  >
                    {uiCopy.importBackup}
                  </Button>
                ) : (
                  <fieldset className="import-decision" aria-label="导入前备份">
                    <b>
                      {importBackupReady ? '备份文件已保存？' : '导入前备份？'}
                    </b>
                    <p>
                      {importBackupReady
                        ? '请确认备份已保存，再继续导入。'
                        : '保存当前备份，便于恢复。'}
                    </p>
                    <div className="settings-actions ui-inline-actions">
                      <Button
                        size="sm"
                        disabled={locked}
                        onClick={() => void importData(!importBackupReady)}
                      >
                        {working
                          ? '处理中…'
                          : importBackupReady
                            ? '已保存，继续导入'
                            : '备份并导入'}
                      </Button>
                      {!importBackupReady && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={locked}
                          onClick={() => void importData(false)}
                        >
                          直接导入
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked}
                        onClick={() => {
                          setImportOpen(false);
                          setImportBackupReady(false);
                          setMessage('');
                        }}
                      >
                        {uiCopy.cancel}
                      </Button>
                    </div>
                  </fieldset>
                )}
              </div>
            )}
          </section>
          <section className="reset-panel dialog-action-section">
            <h3>{uiCopy.clearData}</h3>
            <p>删除全部数据并恢复默认设置，无法撤销。</p>
            {!resetOpen ? (
              <Button
                variant="destructive-quiet"
                size="sm"
                disabled={locked}
                onClick={() => {
                  setResetOpen(true);
                  setBackupBeforeReset(true);
                  setResetBackupReady(false);
                  setImportOpen(false);
                  setResetConfirmed(false);
                  setError('');
                  setMessage('');
                }}
              >
                {uiCopy.clearData}
              </Button>
            ) : (
              <div className="reset-confirmation dialog-action-details">
                <p>清空后只能通过备份恢复，请确认已保留需要的数据。</p>
                <label
                  className="settings-check-row"
                  htmlFor={`${fieldId}-backup-first`}
                >
                  <Checkbox
                    id={`${fieldId}-backup-first`}
                    aria-label="先导出备份"
                    disabled={locked}
                    checked={backupBeforeReset}
                    onCheckedChange={(checked) => {
                      setBackupBeforeReset(checked);
                      setResetBackupReady(false);
                    }}
                  />
                  <span>先导出备份</span>
                </label>
                <label
                  className="settings-check-row"
                  htmlFor={`${fieldId}-reset-confirmed`}
                >
                  <Checkbox
                    id={`${fieldId}-reset-confirmed`}
                    aria-label="确认清空全部数据并恢复默认设置"
                    disabled={locked}
                    checked={resetConfirmed}
                    onCheckedChange={setResetConfirmed}
                  />
                  <span>我确认清空全部数据并重置设置</span>
                </label>
                <div className="reset-actions ui-inline-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={locked}
                    onClick={() => {
                      setResetOpen(false);
                      setResetBackupReady(false);
                      setResetConfirmed(false);
                    }}
                  >
                    {uiCopy.cancel}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={locked || !resetConfirmed}
                    onClick={async () => {
                      if (!resetConfirmed || locked) return;
                      setWorking(true);
                      setError('');
                      try {
                        if (backupBeforeReset && !resetBackupReady) {
                          const result = await downloadBackup();
                          if (result === 'cancelled') {
                            setMessage('已取消备份，数据未清空');
                            return;
                          }
                          if (result === 'downloaded') {
                            setResetBackupReady(true);
                            setMessage(
                              '已开始下载备份，请确认保存完成后再清空数据。',
                            );
                            return;
                          }
                        }
                        await save(
                          {
                            action: 'resetWorkspace',
                            confirmation: 'RESET_WORKSPACE',
                          },
                          '数据已清空',
                        );
                        try {
                          resetViewPreferences(window.localStorage);
                        } catch {
                          /* Storage may be disabled by the browser. */
                        }
                        document.cookie = 'sidebar_state=; path=/; max-age=0';
                        // Remount all views, filters and undo state after the server confirms success.
                        window.location.reload();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setWorking(false);
                      }
                    }}
                  >
                    {working
                      ? '清空中…'
                      : resetBackupReady
                        ? '已保存，清空数据'
                        : uiCopy.clearData}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </DialogBody>
        {error && (
          <p className="formerror" role="alert">
            {error}
          </p>
        )}
        {message && <output className="checkin-success">{message}</output>}
      </DialogContent>
    </Dialog>
  );
}
