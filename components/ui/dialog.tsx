'use client';
import { uiCopy } from '@/lib/ui-copy';

import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

import { cn } from '@/lib/utils';
import { dialogSurfaceClass } from './dialog-surface';
import { backdropMotionClass } from './motion-style';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        backdropMotionClass,
        'fixed inset-0 isolate z-[var(--layer-modal-backdrop)] bg-black/10 supports-backdrop-filter:backdrop-blur-xs ',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  editorLayout,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  editorLayout?: 'form' | 'compact' | 'activity' | 'settings';
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-editor-layout={editorLayout}
        className={cn(
          dialogSurfaceClass,
          editorLayout && 'dialog-layout',
          'fixed top-1/2 left-1/2 z-[var(--layer-modal)] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 text-[length:var(--ui-text-body)] outline-none sm:max-w-sm ',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">{uiCopy.close}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

/** One scroll boundary for editor content; headings and actions stay outside. */
function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('dialog-body', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  layout = 'bleed',
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
  layout?: 'bleed' | 'contained';
}) {
  return (
    <div
      data-slot="dialog-footer"
      data-layout={layout}
      className={cn(
        'flex gap-2 bg-popover',
        layout === 'contained'
          ? 'shrink-0 flex-row flex-wrap items-center justify-end pt-3 pb-1'
          : '-mx-[var(--dialog-inset)] -mb-[var(--dialog-inset)] flex-col-reverse rounded-b-[var(--ui-radius-xl)] p-[var(--dialog-inset)] sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          {uiCopy.close}
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'font-heading text-[length:var(--ui-text-modal-title)] leading-[var(--ui-line-tight)] font-semibold',
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
