export function ColorSwatch({
  color,
  size = 'md',
  className = '',
}: {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass =
    size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/10 ${sizeClass} ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}
