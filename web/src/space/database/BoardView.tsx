import { useRef } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router";
import type { DbRow, Property } from "../api";
import { Chip } from "./cells";
import { groupRows, type BoardColumn } from "./viewLogic";

interface Props {
  rows: DbRow[];
  groupProperty: Property;
  cardProperty?: Property;
  onMove: (rowId: string, optionId: string | null) => void;
  /** Every row in the database, in stored order - the basis for a reorder. */
  allRows: DbRow[];
  onReorder: (orderedIds: string[]) => void;
}

function Card({
  row,
  cardProperty,
  justDragged,
}: {
  row: DbRow;
  cardProperty?: Property;
  justDragged: React.RefObject<boolean>;
}) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });
  const chips =
    cardProperty && Array.isArray(row.values[cardProperty.id])
      ? (row.values[cardProperty.id] as string[])
      : cardProperty && row.values[cardProperty.id]
        ? [row.values[cardProperty.id] as string]
        : [];
  return (
    <div
      ref={setNodeRef}
      className={`board-card${isDragging ? " dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging && !justDragged.current) void navigate(`/p/${row.id}`);
      }}
    >
      <div className="board-card-title">{row.title || "Untitled"}</div>
      {chips.length > 0 && cardProperty && (
        <div className="board-card-chips">
          {chips
            .map((id) => cardProperty.options.find((o) => o.id === id))
            .filter(Boolean)
            .map((o) => (
              <Chip key={o!.id} option={o!} />
            ))}
        </div>
      )}
    </div>
  );
}

function Column({
  column,
  groupProperty,
  cardProperty,
  justDragged,
}: {
  column: BoardColumn;
  groupProperty: Property;
  cardProperty?: Property;
  justDragged: React.RefObject<boolean>;
}) {
  const id = column.option ? `col:${column.option.id}` : "col:none";
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`board-col${isOver ? " over" : ""}`}
      data-column={column.option?.name ?? "none"}
    >
      <div className="board-col-head">
        {column.option ? (
          <Chip option={column.option} />
        ) : (
          <span className="board-col-none">No {groupProperty.name}</span>
        )}
        <span className="board-count">{column.rows.length}</span>
      </div>
      <SortableContext
        items={column.rows.map((r) => r.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="board-cards">
          {column.rows.map((row) => (
            <Card
              key={row.id}
              row={row}
              cardProperty={cardProperty}
              justDragged={justDragged}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function BoardView({
  rows,
  groupProperty,
  cardProperty,
  onMove,
  allRows,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const columns = groupRows(rows, groupProperty);
  const justDragged = useRef(false);

  const onDragEnd = (event: DragEndEvent) => {
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 0);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const row = rows.find((r) => r.id === activeId);
    if (!row) return;

    // Dropping on a column targets that column; dropping on a card targets the card's column.
    const overRow = rows.find((r) => r.id === overId);
    const targetColumn = overId.startsWith("col:")
      ? overId === "col:none"
        ? null
        : overId.replace("col:", "")
      : ((overRow?.values[groupProperty.id] as string | undefined) ?? null);

    if ((row.values[groupProperty.id] ?? null) !== targetColumn) {
      onMove(activeId, targetColumn);
    }

    // Reorder against the full row list, so positions stay meaningful outside the board.
    if (overRow) {
      const ids = allRows.map((r) => r.id);
      const from = ids.indexOf(activeId);
      const to = ids.indexOf(overId);
      if (from !== -1 && to !== -1 && from !== to) {
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        onReorder(ids);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={onDragEnd}
    >
      <div className="board" data-testid="board">
        {columns.map((column) => (
          <Column
            key={column.option?.id ?? "none"}
            column={column}
            groupProperty={groupProperty}
            cardProperty={cardProperty}
            justDragged={justDragged}
          />
        ))}
      </div>
    </DndContext>
  );
}
