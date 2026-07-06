type ColorSwatchProps = {
  color: string;
  size?: 'sm' | 'md';
  className?: string;
};

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
};

export function ColorSwatch({
  color,
  size = 'md',
  className = '',
}: ColorSwatchProps) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/10 ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}
