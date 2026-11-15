export { cn } from './lib/cn.ts';
export {
  formatBRL,
  formatCentsInput,
  formatDate,
  formatPhoneBR,
  formatTime,
} from './lib/format.ts';

export { Badge, badgeVariants, type BadgeProps, type BadgeVariant } from './components/Badge.tsx';
export { Button, buttonVariants, type ButtonProps } from './components/Button.tsx';
export { Checkbox, type CheckboxProps } from './components/Checkbox.tsx';
export { Chip, type ChipProps } from './components/Chip.tsx';
export {
  CurrencyInput,
  parseCentsInput,
  type CurrencyInputProps,
} from './components/CurrencyInput.tsx';
export { DataTable, type DataTableColumn, type DataTableProps } from './components/DataTable.tsx';
export { Field, type FieldProps } from './components/Field.tsx';
export { IconButton, type IconButtonProps } from './components/IconButton.tsx';
export { Input, type InputProps } from './components/Input.tsx';
export { Logo, LogoMark, type LogoProps } from './components/Logo.tsx';
export { SegmentedControl, type SegmentedControlProps } from './components/SegmentedControl.tsx';
export { Select, type SelectOption, type SelectProps } from './components/Select.tsx';
export { Skeleton } from './components/Skeleton.tsx';
export { Spinner } from './components/Spinner.tsx';
export { StatTile, type StatTileProps } from './components/StatTile.tsx';
export {
  EmptyState,
  ErrorState,
  LoadingState,
  type EmptyStateProps,
  type ErrorStateProps,
  type LoadingStateProps,
} from './components/States.tsx';
export { StatusPill, type StatusPillProps } from './components/StatusPill.tsx';
export { Switch, type SwitchProps } from './components/Switch.tsx';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/Tabs.tsx';
export { FunnelBars, type FunnelBarsProps, type FunnelItem } from './components/FunnelBars.tsx';
export { Panel, PanelList, type PanelProps } from './components/Panel.tsx';
export { ToastProvider, useToast } from './components/Toast.tsx';
export { Avatar, type AvatarProps } from './components/Avatar.tsx';
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './components/DropdownMenu.tsx';
export {
  FinancingSimulation,
  type FinancingSimulationProps,
} from './components/FinancingSimulation.tsx';
export {
  KanbanBoard,
  type KanbanBoardProps,
  type KanbanColumn,
} from './components/KanbanBoard.tsx';
export { cardLinkClass, LeadCard, type LeadCardProps } from './components/LeadCard.tsx';
export {
  KeyValueList,
  QualificationPanel,
  type KeyValueRow,
  type QualificationPanelProps,
} from './components/QualificationPanel.tsx';
export { StageProgress, type StageProgressProps } from './components/StageProgress.tsx';
export { Timeline, type TimelineItem } from './components/Timeline.tsx';
export {
  AiDraftComposer,
  ChatThread,
  type AiDraftComposerProps,
  type ChatItem,
  type ChatThreadProps,
} from './components/ChatThread.tsx';
export {
  CalendarWeek,
  calendarStateClasses,
  type CalendarItem,
  type CalendarItemState,
  type CalendarWeekProps,
} from './components/CalendarWeek.tsx';
export { ModuleCard, type ModuleCardProps } from './components/ModuleCard.tsx';
export {
  BudgetPicker,
  ChannelToggle,
  type BudgetPickerProps,
  type ChannelToggleProps,
} from './components/BudgetPicker.tsx';
export { BrowserFrame, PhoneFrame } from './components/Frames.tsx';
export { PhotoPlaceholder } from './components/PhotoPlaceholder.tsx';
export { PropertyCard, type PropertyCardProps } from './components/PropertyCard.tsx';
export { PropertyRow, type PropertyRowProps } from './components/PropertyRow.tsx';
export { Stepper, type StepperProps } from './components/Stepper.tsx';
