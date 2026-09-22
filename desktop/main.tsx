import { createRoot } from 'react-dom/client';
import WorkspacePage from '../components/workspace';
import { serverCalendarDate } from '../lib/calendar-date';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(
  <WorkspacePage initialDate={serverCalendarDate()} />,
);
