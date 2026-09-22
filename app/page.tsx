import WorkspacePage from '@/components/workspace';
import { serverCalendarDate } from '@/lib/calendar-date';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <WorkspacePage initialDate={serverCalendarDate()} />;
}
