'use client';
import { uiCopy } from '@/lib/ui-copy';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChevronDown, Plus } from 'lucide-react';
import type { Label } from '@/lib/model';
export default function TagPicker({
  labels,
  value,
  onChange,
  onCreate,
  variant = 'default',
}: {
  labels: Label[];
  value: string[];
  onChange: (v: string[]) => void;
  onCreate?: (title: string) => Promise<string>;
  variant?: 'default' | 'task-detail';
}) {
  const [name, setName] = useState(''),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    [creating, setCreating] = useState(false);

  const toggle = (id: string, checked: boolean) =>
    onChange(
      checked ? [...value, id] : value.filter((current) => current !== id),
    );

  const create = async () => {
    if (!onCreate || saving || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const id = await onCreate(name.trim());
      onChange([...new Set([...value, id])]);
      setName('');
      setCreating(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (variant === 'task-detail') {
    const selected = labels.filter((label) => value.includes(label.id));
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          className="picker task-tag-trigger"
          aria-label={uiCopy.chooseTags}
          aria-expanded={open}
        >
          <span className="task-tag-trigger-values">
            {selected.length ? (
              <>
                {selected.slice(0, 2).map((label) => (
                  <span key={label.id} className={'pill color' + label.color}>
                    {label.title}
                  </span>
                ))}
                {selected.length > 2 && (
                  <span className="task-tag-overflow">
                    +{selected.length - 2}
                  </span>
                )}
              </>
            ) : (
              <span className="task-tag-placeholder">{uiCopy.chooseTags}</span>
            )}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent
          className="task-detail-property-popover task-tag-popover"
          align="start"
          sideOffset={4}
        >
          <Command>
            <CommandInput placeholder={uiCopy.searchTags} />
            <CommandList>
              <CommandEmpty>{uiCopy.noLabelResults}</CommandEmpty>
              <CommandGroup>
                {labels.map((label) => {
                  const checked = value.includes(label.id);
                  return (
                    <CommandItem
                      key={label.id}
                      value={label.title}
                      data-checked={checked}
                      aria-checked={checked}
                      onSelect={() => toggle(label.id, !checked)}
                    >
                      <span className={'task-tag-dot color' + label.color} />
                      <span>#{label.title}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {onCreate &&
              (creating ? (
                <div className="task-tag-create">
                  <Input
                    // User-opened creation form: start keyboard editing at its name field.
                    // oxlint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    aria-label={uiCopy.newLabelName}
                    maxLength={100}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void create();
                      }
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setCreating(false);
                      }
                    }}
                  />
                  <div className="ui-inline-actions">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => setCreating(false)}
                    >
                      {uiCopy.cancel}
                    </Button>
                    <Button
                      type="button"
                      disabled={saving || !name.trim()}
                      onClick={() => void create()}
                    >
                      {saving ? uiCopy.creating : uiCopy.create}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ui-picker-create"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={14} />
                  {uiCopy.newLabel}</Button>
              ))}
            {error && (
              <p role="alert" className="formerror task-tag-error">
                {error}
              </p>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <fieldset className="tagpicker">
      <legend>{uiCopy.tags}</legend>

      {labels.length ? (
        <div>
          {labels.map((l) => (
            <label key={l.id}>
              <Checkbox
                checked={value.includes(l.id)}
                onCheckedChange={(v) => toggle(l.id, v)}
              />
              <span className={'pill color' + l.color}>#{l.title}</span>
            </label>
          ))}
        </div>
      ) : (
        <p>{uiCopy.noLabels}</p>
      )}
      {onCreate && (
        <div className="inline-label-create">
          <Input
            aria-label={uiCopy.newLabelName}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          />
          <Button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void create()}
          >
            {saving ? uiCopy.creating : uiCopy.create}
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
