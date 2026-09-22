'use client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
} from '@/components/ui/context-menu';
import { palette, normalizeColor } from '@/lib/colors';
import { uiCopy } from '@/lib/ui-copy';

type Props = {
  value: string;
  title?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export default function ColorPreview({ value, disabled, onChange }: Props) {
  return (
    <RadioGroup
      className="ui-color-options"
      aria-label={uiCopy.color}
      value={normalizeColor(value)}
      disabled={disabled}
      onValueChange={(v) => onChange(String(v))}
    >
      {palette.map(([id, label, color]) => (
        <RadioGroupItem
          key={id}
          value={id}
          className="ui-color-swatch"
          aria-label={label}
          title={label}
          style={{ backgroundColor: color }}
        />
      ))}
    </RadioGroup>
  );
}

export function MenuColorPicker({ value, disabled, onChange }: Props) {
  return (
    <ContextMenuRadioGroup
      className="ui-color-options"
      aria-label={uiCopy.color}
      value={normalizeColor(value)}
      onValueChange={(v) => onChange(String(v))}
    >
      {palette.map(([id, label, color]) => (
        <ContextMenuRadioItem
          key={id}
          value={id}
          disabled={disabled}
          className="ui-color-swatch"
          aria-label={label}
          title={label}
          style={{ backgroundColor: color }}
        />
      ))}
    </ContextMenuRadioGroup>
  );
}
