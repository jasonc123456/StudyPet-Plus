/**
 * Subtle notice that AI tutor feedback may be imperfect.
 * Reuse anywhere quiz explanations / hints / review reasons are shown.
 */
export const AI_EXPLANATION_DISCLAIMER =
  'AI explanations may make mistakes. Double-check with your notes or course materials.';

export function AiExplanationDisclaimer({
  className = '',
}: {
  className?: string;
}) {
  return (
    <p
      className={`theme-muted text-xs leading-snug ${className}`.trim()}
      role="note"
    >
      {AI_EXPLANATION_DISCLAIMER}
    </p>
  );
}
