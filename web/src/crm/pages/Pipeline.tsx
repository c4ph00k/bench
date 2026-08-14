import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api";
import { useFetch } from "../hooks";
import {
  DEAL_STAGES,
  Deal,
  DealStage,
  Organization,
  STAGE_COLOR,
  STAGE_PROBABILITY,
  expectedValue,
  isOpen,
  sumExpected,
  sumValue,
} from "../types";
import { formatMoney } from "../format";

export default function Pipeline() {
  const { data: fetched } = useFetch<Deal[]>("/api/crm/deals");
  // Once a card has been dragged the local order wins; until then the fetched list is what shows.
  // Derived rather than copied into state by an effect, which would render twice on every load.
  const [moved, setMoved] = useState<Deal[] | null>(null);
  const deals = moved ?? fetched ?? [];
  const { data: orgs } = useFetch<Organization[]>("/api/crm/organizations");
  const navigate = useNavigate();
  const orgName = useMemo(
    () => new Map((orgs ?? []).map((o) => [o.id, o.name])),
    [orgs],
  );

  function onDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const stage = destination.droppableId as DealStage;
    const id = Number(draggableId);
    // Mirror what the server does, so the totals move with the card rather than after it.
    setMoved((ds) =>
      (ds ?? deals).map((d) =>
        d.id === id
          ? { ...d, stage, probability: STAGE_PROBABILITY[stage] }
          : d,
      ),
    );
    void api.patch(`/api/crm/deals/${id}/stage`, { stage });
  }

  const open = deals.filter(isOpen);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Pipeline</h1>
          <p className="page-sub">
            Drag a deal between columns to change its stage
          </p>
        </div>
        <div className="pipeline-totals">
          <div className="total-block">
            <span className="total-label">Total pipeline</span>
            <span className="total-value" data-testid="pipeline-total">
              {formatMoney(sumValue(open))}
            </span>
          </div>
          <div className="total-block">
            <span className="total-label">Expected revenue</span>
            <span
              className="total-value accent"
              data-testid="pipeline-expected"
            >
              {formatMoney(sumExpected(open))}
            </span>
          </div>
        </div>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board">
          {DEAL_STAGES.map((stage) => {
            const inStage = deals.filter((d) => d.stage === stage);
            const total = sumValue(inStage);
            const expected = sumExpected(inStage);
            return (
              <Droppable droppableId={stage} key={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`board-column${snapshot.isDraggingOver ? " drag-over" : ""}`}
                    data-stage={stage}
                    style={
                      { "--stage": STAGE_COLOR[stage] } as React.CSSProperties
                    }
                  >
                    <div className="board-column-header">
                      <span className="col-title">
                        <span className="col-dot" />
                        {stage}
                      </span>
                      <span className="col-count">{inStage.length}</span>
                    </div>
                    <div className="board-column-totals">
                      <span data-testid={`stage-total-${stage}`}>
                        {formatMoney(total)}
                      </span>
                      <span
                        className="col-expected"
                        data-testid={`stage-expected-${stage}`}
                      >
                        {formatMoney(expected)}
                      </span>
                    </div>
                    <div className="board-cards">
                      {inStage.map((deal, index) => (
                        <Draggable
                          draggableId={String(deal.id)}
                          index={index}
                          key={deal.id}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              // Both come from dragHandleProps too, but ESLint cannot see through
                              // the spread, and these are the values it already sets.
                              role="button"
                              tabIndex={0}
                              className={`deal-card${dragSnapshot.isDragging ? " dragging" : ""}`}
                              onClick={(e) => {
                                if (!e.defaultPrevented)
                                  void navigate(`/deals/${deal.id}`);
                              }}
                              onKeyDown={(e) => {
                                // The library drags from a global keyboard sensor rather than a
                                // handler here, so Space and the arrows still reach it; Enter is
                                // ours and opens the deal.
                                if (e.key === "Enter")
                                  void navigate(`/deals/${deal.id}`);
                              }}
                            >
                              <div className="deal-name">{deal.name}</div>
                              <div className="deal-org">
                                {orgName.get(deal.organization_id ?? -1) ?? ""}
                              </div>
                              <div className="deal-figures">
                                <span className="deal-value">
                                  {formatMoney(deal.value)}
                                </span>
                                <span className="deal-prob">
                                  {deal.probability}%
                                </span>
                              </div>
                              <div className="deal-expected">
                                {formatMoney(expectedValue(deal))} expected
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </>
  );
}
