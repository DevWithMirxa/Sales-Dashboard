"use client";

import React, { Fragment, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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
  onRowClick,
  rowClassName,
  renderSubRow,
  wrapperClassName = "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden",
}) {
  const [sorting, setSorting] = useState(initialSorting);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleColumns = table.getVisibleLeafColumns().length;

  return (
    <div className={wrapperClassName}>
      <Table>
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
                      "px-6 py-3 text-left text-sm font-semibold text-gray-900",
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
                className="px-6 py-4 text-center"
              >
                {loadingMessage}
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleColumns}
                className="px-6 py-4 text-center text-gray-500"
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
                          "px-6 py-4 text-sm text-gray-600",
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
    </div>
  );
}
