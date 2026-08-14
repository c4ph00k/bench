import { ContactStatus, DealStage } from "../types";

export function StatusChip({ status }: { status: ContactStatus }) {
  return <span className={`chip chip-${status}`}>{status}</span>;
}

export function StageChip({ stage }: { stage: DealStage }) {
  return <span className={`chip stage-${stage}`}>{stage}</span>;
}
