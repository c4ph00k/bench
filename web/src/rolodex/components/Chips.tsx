import type { CheckInStatus, Circle } from "../types";
import { CIRCLE_META } from "../types";
import { STATUS_LABEL } from "../format";

export function StatusBadge({
  status,
  title,
}: {
  status: CheckInStatus;
  title?: string;
}) {
  return (
    <span className={`badge status-${status}`} title={title}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CircleChip({
  circle,
  onClick,
}: {
  circle: Circle;
  onClick?: () => void;
}) {
  const label = CIRCLE_META[circle].label;
  if (!onClick) return <span className={`chip circle-${circle}`}>{label}</span>;
  return (
    <button
      type="button"
      className={`chip circle-${circle} chip-clickable`}
      onClick={onClick}
      title={`Filter by ${label} circle`}
    >
      {label}
    </button>
  );
}
