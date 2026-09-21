const getLocalToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

export const normalizeExpense = (item) => ({
  ...item,
  id: item.id,
  amount: Number(item.amount || 0),
  category: item.category || "Other",
  date: item.date || getLocalToday(),
  paymentMode: item.payment_mode || item.paymentMode || "Cash",
  note: item.note || "",
  createdAt: item.created_at || item.createdAt,
});

export const normalizeIncome = (item) => ({
  ...item,
  id: item.id,
  amount: Number(item.amount || 0),
  source: item.source || "Other",
  date: item.date || getLocalToday(),
  paymentMode: item.payment_mode || item.paymentMode || "Bank Transfer",
  note: item.note || "",
  createdAt: item.created_at || item.createdAt,
});

export const normalizeLoan = (item) => ({
  ...item,
  id: item.id,
  loanType: item.loan_type || item.loanType || "Other Loan",
  loanName: item.loan_name || item.loanName || "",
  lender: item.lender || "",
  amount: Number(item.amount ?? item.principal_amount ?? 0),
  principalPaidTillDate: Number(
    item.principal_paid_till_date ?? item.principalPaidTillDate ?? 0
  ),
  interestPaidTillDate: Number(
    item.interest_paid_till_date ?? item.interestPaidTillDate ?? 0
  ),
  originalLoanStartDate:
    item.start_date || item.originalLoanStartDate || item.startDate || "",
  outstanding: Number(item.outstanding ?? item.outstanding_principal ?? 0),
  interestRate: Number(item.interest_rate ?? item.interestRate ?? 0),
  emi: Number(item.emi ?? item.emi_amount ?? 0),
  tenure: Number(
    item.tenure ?? item.remaining_tenure ?? item.tenure_months ?? 0
  ),
  nextEmiDate: item.next_emi_date || item.nextEmiDate || "",
  trackingDate: item.tracking_date || item.trackingDate || "",
  note: item.note || "",
  status: item.status || "Active",
  createdAt: item.created_at || item.createdAt,
});

export const normalizeEmiPayment = (item) => ({
  ...item,
  id: item.id,
  loanId: item.loan_id || item.loanId,
  loanName: item.loan_name || item.loanName || "",
  amount: Number(item.amount || 0),
  principalPaid: Number(item.principal_paid || item.principalPaid || 0),
  interestPaid: Number(item.interest_paid || item.interestPaid || 0),
  remainingPrincipal: Number(
    item.remaining_principal || item.remainingPrincipal || 0
  ),
  paidDate: item.paid_date || item.paidDate || getLocalToday(),
  emiDueDate: item.emi_due_date || item.emiDueDate || "",
  createdAt: item.created_at || item.createdAt,
});

export const normalizePrepaymentPayment = (item) => ({
  ...item,
  id: item.id,
  loanId: item.loan_id || item.loanId,
  loanName: item.loan_name || item.loanName || "",
  amount: Number(item.amount || 0),
  paidDate: item.paid_date || item.paidDate || getLocalToday(),
  strategy: item.strategy || "tenure",
  oldOutstanding: Number(item.old_outstanding ?? item.oldOutstanding ?? 0),
  newOutstanding: Number(item.new_outstanding ?? item.newOutstanding ?? 0),
  oldEmi: Number(item.old_emi ?? item.oldEmi ?? 0),
  newEmi: Number(item.new_emi ?? item.newEmi ?? 0),
  oldTenure: Number(item.old_tenure ?? item.oldTenure ?? 0),
  newTenure: Number(item.new_tenure ?? item.newTenure ?? 0),
  oldNextEmiDate: item.old_next_emi_date || item.oldNextEmiDate || "",
  newNextEmiDate: item.new_next_emi_date || item.newNextEmiDate || "",
  oldStatus: item.old_status || item.oldStatus || "Active",
  newStatus: item.new_status || item.newStatus || "Active",
  note: item.note || "",
  createdAt: item.created_at || item.createdAt || "",
});

