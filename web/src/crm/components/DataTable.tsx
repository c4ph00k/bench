import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ReactNode, useState } from 'react'
import { IconEdit, IconTrash } from './Icons'

interface Props<T> {
  data: T[]
  columns: ColumnDef<T, any>[]
  onRowClick?: (row: T) => void
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  /** Names a row for the action buttons, so "Edit Bluepeak Software" reads correctly. */
  rowLabel?: (row: T) => string
  emptyMessage?: string
  /** Shown on the right of the footer, e.g. a total. */
  summary?: ReactNode
  noun?: string
}

export default function DataTable<T>({
  data,
  columns,
  onRowClick,
  onEdit,
  onDelete,
  rowLabel,
  emptyMessage = 'Nothing here yet.',
  summary,
  noun = 'record',
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const hasActions = Boolean(onEdit || onDelete)
  const label = (row: T) => (rowLabel ? rowLabel(row) : '')

  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  const dir = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className={sortable ? 'sortable' : undefined}
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                      onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="th-inner">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortable && <span className={`sort-arrow${dir ? ' active' : ''}`}>{dir === 'desc' ? '↓' : '↑'}</span>}
                      </span>
                    </th>
                  )
                })}
                {hasActions && <th className="col-actions" />}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? 'clickable' : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
                {hasActions && (
                  <td className="col-actions">
                    <div className="row-actions">
                      {onEdit && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${label(row.original)}`}
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(row.original)
                          }}
                        >
                          <IconEdit size={16} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`Delete ${label(row.original)}`}
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(row.original)
                          }}
                        >
                          <IconTrash size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && <div className="empty-state">{emptyMessage}</div>}
      {data.length > 0 && (
        <div className="table-foot">
          <span>
            {data.length} {noun}
            {data.length === 1 ? '' : 's'}
          </span>
          {summary && <span className="table-summary">{summary}</span>}
        </div>
      )}
    </div>
  )
}
