"use client";

import React, { Fragment, useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStableRowId } from "@/lib/table-utils";

export default function TanStackDataTable({
  columns,
  data,
  loading = false,
  emptyMessage = "No records found.",
  loadingMessage = "Loading...",
  getRowId,
  initialSorting = [],
  // New, optional: pass both to lift sorting state to the parent (e.g. to
  // sort a full dataset before slicing it for client-side pagination).
  // Omit both (as every existing caller does) and behavior is unchanged -
  // the table manages its own sorting state internally.
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  onRowClick,
  rowClassName,
  renderSubRow,
  wrapperClassName = "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden",
  // Optional client-side pagination. When `paginate` is true the component
  // sorts the FULL `data` array (so sorting stays correct across pages), then
  // slices a single page for display and renders a footer with page controls.
  // Existing callers that omit `paginate` get unchanged behavior.
  paginate = false,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
}) {
  const [internalSorting, setInternalSorting] = useState(initialSorting);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const isControlled = controlledSorting !== undefined;
  const sorting = isControlled ? controlledSorting : internalSorting;

  const setSorting = (updater) => {
    // Return to page 1 whenever the sort changes.
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    if (isControlled) controlledOnSortingChange(updater);
    else setInternalSorting(updater);
  };

  // Keep the current page valid when data shrinks (e.g. after a delete) or the
  // page size changes.
  useEffect(() => {
    if (!paginate) return;
    const pageCount = Math.max(1, Math.ceil(data.length / pagination.pageSize));
    setPagination((prev) => ({
      ...prev,
      pageIndex: Math.min(prev.pageIndex, pageCount - 1),
    }));
  }, [data.length, pagination.pageSize, paginate]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(paginate ? { pagination } : {}),
    },
    onSortingChange: setSorting,
    ...(paginate ? { onPaginationChange: setPagination } : {}),
    // When sorting is controlled, the parent is responsible for sorting
    // `data` before it gets here (usually because it's also paginating).
    manualSorting: isControlled,
    getRowId: (row, index) => {
      if (typeof getRowId === "function") {
        const customId = getRowId(row, index);
        if (customId !== undefined && customId !== null && customId !== "") {
          return String(customId);
        }
      }

      return getStableRowId(row, index);
    },
    getCoreRowModel: getCoreRowModel(),
    ...(isControlled ? {} : { getSortedRowModel: getSortedRowModel() }),
    ...(paginate ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  });

  const visibleColumns = table.getVisibleLeafColumns().length;

  return (
    <div className={wrapperClassName}>
      <Table className="table-fixed w-full">
        <TableHeader className="bg-gray-50 border-b border-gray-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();

                return (
                  <TableHead
                    key={header.id}
                    onClick={
                      canSort
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                    className={[
                      "px-2 py-4 sm:px-4 md:px-6 text-center text-sm font-semibold text-gray-900 align-top",
                      canSort ? "cursor-pointer select-none" : "",
                      header.column.columnDef.meta?.headerClassName || "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {canSort &&
                          (sorted === "asc" ? (
                            <ArrowUp className="w-3 h-3 text-gray-700" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="w-3 h-3 text-gray-700" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-gray-400" />
                          ))}
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={visibleColumns}
                className="px-4 py-4 text-center"
              >
                {loadingMessage}
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleColumns}
                className="px-4 py-4 text-center text-gray-500"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row, index) => {
              const fallbackRowKey = getStableRowId(row.original, index);
              const rawRowKey = [
                row.id,
                row.original?.id,
                row.original?._id,
                fallbackRowKey,
              ].find(
                (value) =>
                  value !== undefined &&
                  value !== null &&
                  value !== "" &&
                  String(value) !== "undefined" &&
                  String(value) !== "null",
              );
              const rowKey = String(
                rawRowKey ?? fallbackRowKey ?? `row-${index}`,
              );

              return (
                <Fragment key={rowKey}>
                  <TableRow
                    onClick={
                      onRowClick ? () => onRowClick(row.original) : undefined
                    }
                    className={[
                      "border-b border-gray-200 hover:bg-gray-50",
                      onRowClick ? "cursor-pointer" : "",
                      typeof rowClassName === "function"
                        ? rowClassName(row.original)
                        : rowClassName || "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={[
                          "px-1 py-1 sm:px-4 md:px-6 md:py-2 text-xs text-gray-600 align-top wrap-break-word",
                          cell.column.columnDef.meta?.cellClassName || "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderSubRow
                    ? renderSubRow(row.original, visibleColumns)
                    : null}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination footer (only when enabled and there are rows to page) */}
      {paginate &&
        !loading &&
        table.getRowModel().rows.length > 0 &&
        (() => {
          const pageIndex = pagination.pageIndex;
          const pageCount = table.getPageCount();
          const rangeStart = pageIndex * pagination.pageSize + 1;
          const rangeEnd = Math.min(
            (pageIndex + 1) * pagination.pageSize,
            data.length,
          );

          const pageNumbers = [];
          const span = 2;
          for (
            let p = Math.max(1, pageIndex + 1 - span);
            p <= Math.min(pageCount, pageIndex + 1 + span);
            p++
          ) {
            pageNumbers.push(p);
          }

          return (
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) =>
                    setPagination({
                      pageIndex: 0,
                      pageSize: Number(e.target.value),
                    })
                  }
                  className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {pageSizeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>
                  {rangeStart}-{rangeEnd} of {data.length} rows
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPagination((p) => ({ ...p, pageIndex: 0 }))}
                  disabled={pageIndex === 0}
                  className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      pageIndex: Math.max(0, p.pageIndex - 1),
                    }))
                  }
                  disabled={pageIndex === 0}
                  className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers.map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, pageIndex: p - 1 }))
                    }
                    className={`w-8 h-8 rounded-full text-sm font-medium ${
                      p === pageIndex + 1
                        ? "bg-slate-800 text-white"
                        : "border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      pageIndex: Math.min(pageCount - 1, p.pageIndex + 1),
                    }))
                  }
                  disabled={pageIndex === pageCount - 1}
                  className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setPagination((p) => ({ ...p, pageIndex: pageCount - 1 }))
                  }
                  disabled={pageIndex === pageCount - 1}
                  className="p-2 rounded-full border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
