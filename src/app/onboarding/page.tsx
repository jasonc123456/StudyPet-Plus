import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { prisma } from '@/lib/prisma';

// First-run onboarding gate. Requires a session; if the user has already
// completed onboarding we bounce them straight to the dashboard so this page
// only ever shows once.
export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, image: true, onboardedAt: true },
  });

  if (user?.onboardedAt) {
    redirect('/dashboard');
  }

  return (
    <OnboardingForm
      defaultName={user?.name ?? ''}
      defaultImage={user?.image ?? '/profile-pics/1.png'}
    />
  );
}
