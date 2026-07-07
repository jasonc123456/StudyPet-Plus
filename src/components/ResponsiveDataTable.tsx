import { type ReactNode } from 'react';

type ResponsiveDataTableProps = {
  children: ReactNode;
};

export function ResponsiveDataTable({ children }: ResponsiveDataTableProps) {
  return (
    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
      {children}
    </div>
  );
}
