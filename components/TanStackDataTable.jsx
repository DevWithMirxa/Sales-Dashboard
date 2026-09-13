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
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  onRowClick,
  rowClassName,
  renderSubRow,
  wrapperClassName = "bg-card/90 backdrop-blur-sm rounded-xl border border-border/70 overflow-hidden shadow-xs",
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
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    if (isControlled) controlledOnSortingChange(updater);
    else setInternalSorting(updater);
  };

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
        <TableHeader className="bg-secondary/60 border-b border-border/70">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-border/70">
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
                      "px-4 py-3 text-left text-xs font-semibold text-foreground tracking-tight align-middle",
                      canSort ? "cursor-pointer select-none hover:text-accent transition-colors" : "",
                      header.column.columnDef.meta?.headerClassName || "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1.5">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {canSort &&
                          (sorted === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-accent" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="w-3.5 h-3.5 text-accent" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/60" />
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
                className="px-4 py-8 text-center text-xs text-muted-foreground"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span>{loadingMessage}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleColumns}
                className="px-4 py-8 text-center text-xs text-muted-foreground"
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
                      "border-b border-border/50 hover:bg-secondary/40 transition-colors duration-150",
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
                          "px-4 py-3 text-xs text-foreground/90 align-middle wrap-break-word font-normal",
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

      {/* Pagination footer */}
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
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-border/70 bg-card/60 text-xs text-muted-foreground">
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
                  className="border border-border/70 rounded-md px-2 py-1 bg-secondary text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
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
                  className="p-1.5 rounded-md border border-border/70 disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      pageIndex: Math.max(0, p.pageIndex - 1),
                    }))
                  }
                  disabled={pageIndex === 0}
                  className="p-1.5 rounded-md border border-border/70 disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {pageNumbers.map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, pageIndex: p - 1 }))
                    }
                    className={`w-7 h-7 rounded-md text-xs font-semibold transition-colors ${
                      p === pageIndex + 1
                        ? "bg-accent text-accent-foreground"
                        : "border border-border/70 hover:bg-secondary text-foreground"
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
                  className="p-1.5 rounded-md border border-border/70 disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    setPagination((p) => ({ ...p, pageIndex: pageCount - 1 }))
                  }
                  disabled={pageIndex === pageCount - 1}
                  className="p-1.5 rounded-md border border-border/70 disabled:opacity-30 hover:bg-secondary transition-colors"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
