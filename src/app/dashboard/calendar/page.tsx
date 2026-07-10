import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CalendarBrowserView } from '@/components/calendar/CalendarBrowserView';
import { CalendarSubscriptionManager } from '@/components/calendar/CalendarSubscriptionManager';
import { PageHeader } from '@/components/courses/PageHeader';
import {
  getCalendarPageData,
  getDayParam,
  getMonthParam,
} from '@/lib/calendar';

type CalendarPageProps = {
  searchParams: {
    month?: string;
    day?: string;
  };
};

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const data = await getCalendarPageData(
    session.user.id,
    searchParams.month,
    searchParams.day
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        description="See assignments, quests, and imported ICS calendars in one working schedule."
      />

      <CalendarBrowserView
        initialMonth={getMonthParam(data.month)}
        initialSelectedDate={getDayParam(data.selectedDate)}
        initialGridStart={data.gridStart.toISOString()}
        initialGridEnd={data.gridEnd.toISOString()}
        initialEvents={data.events.map((event) => ({
          ...event,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt ? event.endsAt.toISOString() : null,
        }))}
        autoSyncSubscriptionIds={data.subscriptions
          .filter((subscription) => subscription.autoSync)
          .map((subscription) => subscription.id)}
        initialShowAllGroupTasks={data.showAllGroupTasks}
      />

      <CalendarSubscriptionManager subscriptions={data.subscriptions} />
    </div>
  );
}
