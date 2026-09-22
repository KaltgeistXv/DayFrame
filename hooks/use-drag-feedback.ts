'use client';
import { useEffect } from 'react';
import { installDragFeedback } from '@/lib/drag-feedback';

export function useDragFeedback() {
  useEffect(() => installDragFeedback(document), []);
}
