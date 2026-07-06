import { typeBadgeClass, typeLabel } from '@/lib/format';

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeBadgeClass(type)}`}
    >
      {typeLabel(type)}
    </span>
  );
}
