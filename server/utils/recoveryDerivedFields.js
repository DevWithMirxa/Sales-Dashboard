/**
 * Shared by recoveryController.js and dashboardController.js so the
 * Paid/Partial/Overdue/Pending status + balance logic can never drift out
 * of sync between the Recovery page and the dashboard's Recovery KPI.
 *
 * Balance / Days Overdue / Status are computed fresh on every read rather
 * than stored, since the latter two depend on today's date - see the note
 * in models/Recovery.js.
 */
const computeDerivedFields = (record) => {
  const invoiceAmount = Number(record.invoiceAmount || 0);
  const amountRecovered = Number(record.amountRecovered || 0);
  const balance = Math.max(0, invoiceAmount - amountRecovered);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let dueDate = record.dueDate ? new Date(record.dueDate) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);

  const isPastDue = balance > 0 && dueDate && today > dueDate;
  const daysOverdue = isPastDue
    ? Math.round((today - dueDate) / (1000 * 60 * 60 * 24))
    : 0;

  let status;
  if (balance === 0) {
    status = "Paid";
  } else if (amountRecovered > 0) {
    status = "Partial";
  } else if (isPastDue) {
    status = "Overdue";
  } else {
    status = "Pending";
  }

  return { balance, daysOverdue, status };
};

const withDerivedFields = (doc) => {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return { ...plain, ...computeDerivedFields(plain) };
};

module.exports = { computeDerivedFields, withDerivedFields };
