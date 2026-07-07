type DashboardPanelProps = {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
};

export function DashboardPanel({
  children,
  className = '',
  padding = true,
}: DashboardPanelProps) {
  return (
    <div
      className={['dashboard-panel', padding ? '' : '!p-0', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
