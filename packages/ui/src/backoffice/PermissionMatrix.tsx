import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

export type PermissionMatrixProps = {
  caption: string;
  permissionHeader: string;
  roles: { key: string; label: string }[];
  rows: { key: string; label: ReactNode; allowed: Record<string, boolean> }[];
  /** Screen-reader text for each cell. */
  yesLabel: string;
  noLabel: string;
};

/** "O que cada papel pode fazer" (BO8): a check where the role may act, a dash where not. */
export function PermissionMatrix({
  caption,
  permissionHeader,
  roles,
  rows,
  yesLabel,
  noLabel,
}: PermissionMatrixProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full border-collapse type-body-s">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-canvas">
          <tr>
            <th
              scope="col"
              className="border-b border-line px-3 py-2.5 text-left type-caption font-medium text-fg"
            >
              {permissionHeader}
            </th>
            {roles.map((role) => (
              <th
                key={role.key}
                scope="col"
                className="border-b border-line px-3 py-2.5 text-center type-caption font-medium text-fg"
              >
                {role.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-line last:border-b-0">
              <th scope="row" className="px-3 py-2.5 text-left font-normal text-fg">
                {row.label}
              </th>
              {roles.map((role) => {
                const allowed = row.allowed[role.key] ?? false;
                return (
                  <td key={role.key} className="px-3 py-2.5 text-center">
                    {allowed ? (
                      <Check aria-hidden="true" className="inline size-4 text-success" />
                    ) : (
                      <Minus aria-hidden="true" className="inline size-4 text-fg-muted" />
                    )}
                    <span className="sr-only">{allowed ? yesLabel : noLabel}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
