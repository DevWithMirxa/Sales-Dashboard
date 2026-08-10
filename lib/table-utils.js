function getStableRowId(row, index) {
  if (row && (row.id || row._id)) {
    const rawId = String(row.id ?? row._id);
    return rawId && rawId !== "undefined" && rawId !== "null"
      ? `${rawId}-${index}`
      : `row-${index}`;
  }

  return `row-${index}`;
}

module.exports = { getStableRowId };
