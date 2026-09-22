import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  previousLabel: string;
  nextLabel: string;
  currentLabel?: string;
  onPrevious: () => void;
  onCurrent: () => void;
  onNext: () => void;
  disabled?: boolean;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  iconSize?: number;
};

/** No wrapper: preserve each toolbar's flex layout and keyboard order. */
export function DateStepControls({ previousLabel, nextLabel, currentLabel = '今天', onPrevious, onCurrent, onNext, disabled = false, previousDisabled = false, nextDisabled = false, iconSize = 16 }: Props) {
  return <>
    <button type="button" className="iconbtn date-toolbar-arrow" aria-label={previousLabel} disabled={disabled || previousDisabled} onClick={onPrevious}><ChevronLeft size={iconSize} /></button>
    <button type="button" className="subtle date-toolbar-current" disabled={disabled} onClick={onCurrent}>{currentLabel}</button>
    <button type="button" className="iconbtn date-toolbar-arrow" aria-label={nextLabel} disabled={disabled || nextDisabled} onClick={onNext}><ChevronRight size={iconSize} /></button>
  </>;
}
