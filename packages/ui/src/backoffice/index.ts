/** Backoffice (staff app) building blocks. Separate entry: `@casvitta/ui/backoffice`. */
export { Dialog, type DialogProps } from '../components/Dialog.tsx';
export {
  BackofficePageHeader,
  BackofficeShell,
  EnvironmentBadge,
  type BackofficeNavGroup,
  type BackofficeNavItem,
  type BackofficePageHeaderProps,
  type BackofficeShellProps,
  type EnvironmentBadgeProps,
} from './BackofficeShell.tsx';
export { PermissionMatrix, type PermissionMatrixProps } from './PermissionMatrix.tsx';
export {
  ActivityList,
  QueueList,
  type ActivityListProps,
  type QueueListItem,
  type QueueListProps,
} from './Overview.tsx';
export {
  QueueTable,
  Textarea,
  type QueueColumn,
  type QueueTableProps,
  type TextareaProps,
} from './QueueTable.tsx';
