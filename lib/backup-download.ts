import { makeBackup } from './backup';

type SaveHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
};
type SaveWindow = Window & {
  dayframeDesktop?: {
    saveBackup: (name: string, content: string) => Promise<'saved' | 'cancelled'>;
  };
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<SaveHandle>;
};
export type BackupSaveResult = 'saved' | 'downloaded' | 'cancelled';

export async function downloadBackup(): Promise<BackupSaveResult> {
  const name = `DayFrame-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const picker = (window as SaveWindow).showSaveFilePicker;
  let handle: SaveHandle | undefined;
  // Open before any network await to retain the user's activation.
  if (picker) {
    try {
      handle = await picker.call(window, {
        suggestedName: name,
        types: [
          {
            description: 'DayFrame JSON 备份',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled';
      throw Error('无法打开保存窗口，请重试或检查浏览器的文件权限');
    }
  }
  const response = await fetch('/api/workspace', { cache: 'no-store' });
  if (!response.ok) throw Error('无法读取完整数据，请重试');
  const blob = new Blob(
    [JSON.stringify(makeBackup(await response.json()), null, 2)],
    { type: 'application/json' },
  );
  const desktop = (window as SaveWindow).dayframeDesktop;
  if (desktop) return desktop.saveBackup(name, await blob.text());
  if (handle) {
    const stream = await handle.createWritable();
    try {
      await stream.write(blob);
      await stream.close();
    } catch {
      try {
        await stream.abort();
      } catch {
        /* Preserve the original write failure. */
      }
      throw Error('备份未保存成功，请检查目标文件夹后重试');
    }
    return 'saved';
  }
  // Browsers without a file picker control the destination in download settings.
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
}
