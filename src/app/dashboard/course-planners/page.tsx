import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { CoursePlannerPageClient } from '@/components/planners/CoursePlannerPageClient';
import { getCoursePlannerPageData } from '@/lib/course-planners';

export default async function CoursePlannersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const data = await getCoursePlannerPageData(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Course Planner"
        description="Build multiple semester or quarter plans, organize them by term, and keep backup classes ready in case registration changes."
      />
      <CoursePlannerPageClient {...data} />
    </div>
  );
}
