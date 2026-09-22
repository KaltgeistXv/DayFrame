'use client';
import { uiCopy } from '@/lib/ui-copy';
import { useId, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { Preferences } from '@/lib/model';

export default function WorkspaceSettingsForm({
  preferences,
  busy,
  save,
}: {
  preferences: Preferences;
  busy: boolean;
  save: (payload: unknown, message?: string) => Promise<unknown>;
}) {
  const fieldId = useId();
  const pending = useRef(false);
  const [name, setName] = useState(preferences.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const locked = busy || saving;
  return (
    <form
      className="dialog-action-section settings-name-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const nextName = name.trim();
        if (
          locked ||
          pending.current ||
          !nextName ||
          nextName === preferences.name
        )
          return;
        pending.current = true;
        setSaving(true);
        setError('');
        setMessage('');
        try {
          await save(
            {
              action: 'savePreferences',
              preferences: { ...preferences, name: nextName },
            },
            uiCopy.nameSaved,
          );
          setName(nextName);
          setMessage(uiCopy.nameSaved);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          pending.current = false;
          setSaving(false);
        }
      }}
    >
      <label htmlFor={fieldId} className="task-title-field">
        {uiCopy.name}
        <Input
          id={fieldId}
          aria-label="工作空间名称"
          maxLength={60}
          required
          disabled={locked}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
            setMessage('');
          }}
        />
      </label>
      <Button
        type="submit"
        size="sm"
        disabled={locked || !name.trim() || name.trim() === preferences.name}
      >
        {saving ? uiCopy.saving : uiCopy.save}
      </Button>
      {error && (
        <p className="formerror dialog-action-details" role="alert">
          {error}
        </p>
      )}
      {message && (
        <output className="checkin-success dialog-action-details">
          {message}
        </output>
      )}
    </form>
  );
}
