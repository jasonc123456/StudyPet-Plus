import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { GradeTrackerPage } from '@/components/grades/GradeTrackerPage';
import { getGradeTrackerPageData } from '@/lib/grades';

export default async function GradesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const data = await getGradeTrackerPageData(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Grade Tracker"
        description="Track weighted categories, graded assignments, and projected GPA across your courses."
      />
      <GradeTrackerPage {...data} />
    </div>
  );
}
