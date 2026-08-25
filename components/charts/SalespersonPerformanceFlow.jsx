import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * SalespersonPerformanceFlow
 * ---------------------------------------------------------------
 * "Comparison flow chart" - shows how each rep's (or product's)
 * share of team revenue shifts from one period to the next.
 *
 * HOW TO WIRE REAL DATA
 * ---------------------------------------------------------------
 * Pass a `data` prop shaped like this (one object per period,
 * in the order you want columns to appear):
 *
 * const data = [
 *   {
 *     period: "Q1",
 *     entries: [
 *       { id: "rep_ahmed",  name: "Ahmed Raza",   value: 45200 },
 *       { id: "rep_bilal",  name: "Bilal Khan",   value: 31900 },
 *       { id: "rep_sana",   name: "Sana Tariq",   value: 22300 },
 *       { id: "rep_omar",   name: "Omar Farooq",  value: 14800 },
 *     ],
 *   },
 *   { period: "Q2", entries: [ ... ] },
 *   { period: "Q3", entries: [ ... ] },
 *   { period: "Q4", entries: [ ... ] },
 * ];
 *
 * Rules:
 * - `id` must be STABLE across periods for the same rep (this is
 *   what lets the chart draw a ribbon connecting their block from
 *   one quarter to the next). `name` is just the display label.
 * - `value` is revenue (or any single numeric metric). The chart
 *   converts it to a % share of that period's total automatically.
 * - A rep can be missing from a period (e.g. new hire, or left
 *   the team) - the chart just won't draw a ribbon in/out of the
 *   quarter they're absent from.
 *
 * <SalespersonPerformanceFlow data={data} />
 *
 * SIZING
 * ---------------------------------------------------------------
 * This chart always fills its parent's width - no horizontal
 * scrollbar. It measures the parent container and lays out exactly
 * that many pixels' worth of columns, so more periods (e.g. 12
 * months) means narrower columns rather than an oversized chart
 * that gets scaled down (illegible) or scrolled (ugly). Column
 * width is capped at `colW` so a handful of periods don't stretch
 * into giant blocks; below that cap, font size and label length
 * scale down together so names stay legible instead of overlapping.
 *
 * Optional props:
 * - metricLabel: string shown after the value, e.g. "k" or "PKR k" (default "k")
 * - colors: { [id]: "#hex" } to pin specific colors to specific reps
 * - height: chart height in px (default 460)
 * - colW: the MAXIMUM width in px of each period's column (default 168).
 *   Columns shrink below this automatically to fit the container when
 *   there are many periods.
 */

const DEFAULT_PALETTE = [
  "#C9B65C", // olive
  "#5FBFBF", // teal
  "#9FD9A0", // sage green
  "#D9A066", // terracotta/tan
  "#8FA6D9", // steel blue
  "#C98FC9", // muted plum
  "#D9C46A", // mustard
  "#7FC9A0", // mint
];

const clampNum = (value, min, max) => Math.min(max, Math.max(min, value));

// Shared offscreen canvas used to measure text with the real rendered glyph
// widths. This makes truncation exact instead of estimating from a rough
// character-width heuristic, so labels never spill past their column (where
// the last column would run out of the box).
let measureCtx = null;
const getMeasureContext = () => {
  if (typeof document === "undefined") return null;
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext && canvas.getContext("2d");
  }
  return measureCtx;
};

const ELLIPSIS = "\u2026";

// Trims `name` (via real measurement when available) so it fits within
// `maxWidthPx`, suffixing with an ellipsis when it doesn't. `weight` mirrors
// the label's SVG fontWeight so bold names measure wider correctly.
const truncateLabel = (name, maxWidthPx, fontSize, weight = 400) => {
  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = `${weight} ${fontSize}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(name).width <= maxWidthPx) return name;
    if (ctx.measureText(ELLIPSIS).width >= maxWidthPx) return ELLIPSIS;
    let out = name;
    while (
      out.length > 0 &&
      ctx.measureText(`${out}${ELLIPSIS}`).width > maxWidthPx
    ) {
      out = out.slice(0, -1);
    }
    return out.length ? `${out}${ELLIPSIS}` : ELLIPSIS;
  }
  // Fallback heuristic for SSR / very first paint before the canvas exists.
  // Deliberately conservative (0.62) so nothing appears to overflow.
  const avgCharWidth = fontSize * 0.62;
  const maxChars = Math.max(1, Math.floor(maxWidthPx / avgCharWidth));
  if (name.length <= maxChars) return name;
  if (maxChars <= 1) return ELLIPSIS;
  return `${name.slice(0, maxChars - 1)}${ELLIPSIS}`;
};

function ribbonPath(x1, y1top, y1bot, x2, y2top, y2bot) {
  const midX = (x1 + x2) / 2;
  return `
    M ${x1} ${y1top}
    C ${midX} ${y1top}, ${midX} ${y2top}, ${x2} ${y2top}
    L ${x2} ${y2bot}
    C ${midX} ${y2bot}, ${midX} ${y1bot}, ${x1} ${y1bot}
    Z
  `;
}

export default function SalespersonPerformanceFlow({
  data = SAMPLE_DATA,
  metricLabel = "k",
  colors = {},
  height = 460,
  colW = 168,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const containerRef = useRef(null);
  // Fallback before the first real measurement (SSR / first paint) - not
  // a hard width, just something reasonable so nothing is zero-size.
  const [containerWidth, setContainerWidth] = useState(1000);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = data.length;
  const width = Math.max(containerWidth, 1);

  // Horizontal padding so the first/last columns (and their labels) never sit
  // flush against the box edge, regardless of how the container is sized.
  const padX = 12;
  const innerWidth = Math.max(1, width - padX * 2);

  // Base gap between columns scales gently with column width so tightly
  // packed charts (many periods) don't lose extra space to fixed gutters.
  const baseGap = count > 1 ? clampNum(innerWidth * 0.012, 6, 24) : 0;

  // Fill the inner (padding-aware) width. Columns are capped at `colW` so a
  // handful of periods stay a comfortable size rather than stretching
  // edge-to-edge; with many periods they shrink to fit instead of
  // overflowing into a scrollbar.
  const rawColW =
    count > 0 ? (innerWidth - baseGap * (count - 1)) / count : colW;
  const finalColW = Math.max(1, Math.min(colW, rawColW));

  // When columns are capped (few periods on a wide container) there's
  // leftover space that would otherwise pile up as blank at the right edge.
  // Spread it evenly into the gutters so the columns separate out across the
  // full inner width (larger gaps between them) instead of hugging the left.
  const gap =
    count > 1 ? (innerWidth - finalColW * count) / (count - 1) : baseGap;

  // Font sizes scale down together with column width so labels shrink
  // gracefully instead of overlapping when many periods are shown.
  const headerFont = clampNum(finalColW * 0.065, 10, 13);
  const headerSubFont = clampNum(finalColW * 0.058, 9, 11.5);
  const nameFont = clampNum(finalColW * 0.062, 9, 12);
  const detailFont = clampNum(finalColW * 0.055, 8, 10.5);

  const headerH = 46;
  const plotTop = headerH + 14;
  const plotBottom = height - 20;
  const plotH = plotBottom - plotTop;

  const grandTotal = useMemo(
    () =>
      data.reduce(
        (sum, p) => sum + p.entries.reduce((s, e) => s + e.value, 0),
        0,
      ),
    [data],
  );

  const colorFor = (id, idx) =>
    colors[id] || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];

  // Assign a stable color per id based on first-seen order
  const idOrder = useMemo(() => {
    const seen = [];
    data.forEach((p) =>
      p.entries.forEach((e) => {
        if (!seen.includes(e.id)) seen.push(e.id);
      }),
    );
    return seen;
  }, [data]);

  const columns = useMemo(() => {
    return data.map((period, i) => {
      const total = period.entries.reduce((s, e) => s + e.value, 0);
      const sorted = [...period.entries].sort((a, b) => b.value - a.value);
      let cursor = 0;
      const blocks = sorted.map((e) => {
        const pct = total > 0 ? e.value / total : 0;
        const y1 = plotTop + cursor * plotH;
        const y2 = plotTop + (cursor + pct) * plotH;
        cursor += pct;
        return {
          ...e,
          pct,
          y1,
          y2,
          color: colorFor(e.id, idOrder.indexOf(e.id)),
        };
      });
      const x = padX + i * (finalColW + gap);
      const pctOfAll = grandTotal > 0 ? total / grandTotal : 0;
      return { period: period.period, x, total, pctOfAll, blocks };
    });
  }, [data, plotTop, plotH, finalColW, gap, grandTotal, idOrder]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        {/* Ribbons (drawn first, behind blocks) */}
        {columns.slice(0, -1).map((col, i) => {
          const next = columns[i + 1];
          return col.blocks.map((b) => {
            const nb = next.blocks.find((e) => e.id === b.id);
            if (!nb) return null;
            const dimmed = hoveredId && hoveredId !== b.id;
            return (
              <path
                key={`${col.period}-${b.id}-ribbon`}
                d={ribbonPath(
                  col.x + finalColW,
                  b.y1,
                  b.y2,
                  next.x,
                  nb.y1,
                  nb.y2,
                )}
                fill={b.color}
                opacity={dimmed ? 0.06 : 0.28}
                style={{ transition: "opacity 150ms ease" }}
              />
            );
          });
        })}

        {/* Columns */}
        {columns.map((col) => {
          const headerLabel = truncateLabel(col.period, finalColW, headerFont, 700);
          const headerSub = `(${(col.pctOfAll * 100).toFixed(0)}%, ${(col.total / 1000).toFixed(1)}${metricLabel})`;
          return (
            <g key={col.period}>
              {/* Header */}
              <title>{col.period}</title>
              <text
                x={col.x}
                y={20}
                fontSize={headerFont}
                fontWeight={700}
                fill="#2b2b2b"
              >
                {headerLabel}
              </text>
              <text x={col.x} y={36} fontSize={headerSubFont} fill="#6b6b6b">
                {truncateLabel(headerSub, finalColW, headerSubFont, 400)}
              </text>

              {/* Blocks */}
              {col.blocks.map((b) => {
                const h = b.y2 - b.y1;
                const dimmed = hoveredId && hoveredId !== b.id;
                const showLabels = h > 20;
                const detailText = `${(b.pct * 100).toFixed(0)}% (${(b.value / 1000).toFixed(1)}${metricLabel})`;
                return (
                  <g
                    key={b.id}
                    onMouseEnter={() => setHoveredId(b.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{`${b.name} - ${detailText}`}</title>
                    <rect
                      x={col.x}
                      y={b.y1}
                      width={finalColW}
                      height={h}
                      fill={b.color}
                      opacity={dimmed ? 0.35 : 0.9}
                      style={{ transition: "opacity 150ms ease" }}
                    />
                    {showLabels && (
                      <>
                        <text
                          x={col.x + 6}
                          y={b.y1 + nameFont + 4}
                          fontSize={nameFont}
                          fontWeight={600}
                          fill="#2b2b2b"
                        >
                          {truncateLabel(b.name, finalColW - 10, nameFont, 600)}
                        </text>
                        <text
                          x={col.x + 6}
                          y={b.y1 + nameFont + detailFont + 8}
                          fontSize={detailFont}
                          fill="#3d3d3d"
                        >
                          {truncateLabel(
                            detailText,
                            finalColW - 10,
                            detailFont,
                            400,
                          )}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
