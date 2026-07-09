import { auth } from '@/auth';
import { GroupJoinCard } from '@/components/groups/GroupJoinCard';

type JoinPageProps = {
  searchParams: {
    token?: string;
  };
};

export default async function GroupJoinPage({ searchParams }: JoinPageProps) {
  const session = await auth();

  return (
    <GroupJoinCard
      token={searchParams.token ?? ''}
      signedIn={Boolean(session?.user?.id)}
    />
  );
}
