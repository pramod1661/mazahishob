const withId = (row, payload) =>
  row?.id ? { id: row.id, ...payload } : payload;

export const validateBackupData = (data, ownerEmail = "") => {
  if (
    !data ||
    !Array.isArray(data.expenses) ||
    !Array.isArray(data.incomes) ||
    !Array.isArray(data.loans)
  ) {
    throw new Error("Invalid Maza Hishob backup file.");
  }

  if (
    data.ownerEmail &&
    ownerEmail &&
    String(data.ownerEmail).toLowerCase() !== String(ownerEmail).toLowerCase()
  ) {
    throw new Error(
      `This backup belongs to ${data.ownerEmail}. Please sign in with the same Google account to restore it.`
    );
  }

  return data;
};

export const mapBackupToDatabaseRows = (backup, userId, today) => ({
  expenses: (backup.expenses || []).map((item) =>
    withId(item, {
      user_id: userId,
      amount: Number(item.amount || 0),
      category: item.category || "Other",
      date: item.date || today,
      payment_mode: item.payment_mode || item.paymentMode || "Cash",
      note: item.note || "",
    })
  ),
  incomes: (backup.incomes || []).map((item) =>
    withId(item, {
      user_id: userId,
      amount: Number(item.amount || 0),
      source: item.source || "Other",
      date: item.date || today,
      payment_mode: item.payment_mode || item.paymentMode || "Bank Transfer",
      note: item.note || "",
    })
  ),
  loans: (backup.loans || []).map((item) =>
    withId(item, {
      user_id: userId,
      loan_type: item.loan_type || item.loanType || "Other Loan",
      loan_name: item.loan_name || item.loanName || "",
      lender: item.lender || "",
      amount: Number(item.amount ?? item.principal_amount ?? 0),
      principal_paid_till_date: Number(
        item.principal_paid_till_date ?? item.principalPaidTillDate ?? 0
      ),
      interest_paid_till_date: Number(
        item.interest_paid_till_date ?? item.interestPaidTillDate ?? 0
      ),
      start_date:
        item.start_date || item.originalLoanStartDate || item.startDate || null,
      outstanding: Number(item.outstanding ?? item.outstanding_principal ?? 0),
      interest_rate: Number(item.interest_rate ?? item.interestRate ?? 0),
      emi: Number(item.emi ?? item.emi_amount ?? 0),
      tenure: Number(
        item.tenure ?? item.remaining_tenure ?? item.tenure_months ?? 0
      ),
      next_emi_date: item.next_emi_date || item.nextEmiDate || null,
      tracking_date: item.tracking_date || item.trackingDate || null,
      note: item.note || "",
      status: item.status || "Active",
    })
  ),
  emiPayments: (backup.emiPayments || []).map((item) =>
    withId(item, {
      user_id: userId,
      loan_id: item.loan_id || item.loanId,
      loan_name: item.loan_name || item.loanName || "",
      amount: Number(item.amount || 0),
      paid_date: item.paid_date || item.paidDate || today,
      emi_due_date: item.emi_due_date || item.emiDueDate || null,
      principal_paid: Number(item.principal_paid ?? item.principalPaid ?? 0),
      interest_paid: Number(item.interest_paid ?? item.interestPaid ?? 0),
      remaining_principal: Number(
        item.remaining_principal ?? item.remainingPrincipal ?? 0
      ),
    })
  ),
  prepaymentPayments: (backup.prepaymentPayments || []).map((item) =>
    withId(item, {
      user_id: userId,
      loan_id: String(item.loan_id || item.loanId || ""),
      loan_name: item.loan_name || item.loanName || "",
      amount: Number(item.amount || 0),
      paid_date: item.paid_date || item.paidDate || today,
      strategy: item.strategy || "tenure",
      old_outstanding: Number(
        item.old_outstanding ?? item.oldOutstanding ?? 0
      ),
      new_outstanding: Number(
        item.new_outstanding ?? item.newOutstanding ?? 0
      ),
      old_emi: Number(item.old_emi ?? item.oldEmi ?? 0),
      new_emi: Number(item.new_emi ?? item.newEmi ?? 0),
      old_tenure: Number(item.old_tenure ?? item.oldTenure ?? 0),
      new_tenure: Number(item.new_tenure ?? item.newTenure ?? 0),
      old_next_emi_date:
        item.old_next_emi_date || item.oldNextEmiDate || null,
      new_next_emi_date:
        item.new_next_emi_date || item.newNextEmiDate || null,
      old_status: item.old_status || item.oldStatus || "Active",
      new_status: item.new_status || item.newStatus || "Active",
      note: item.note || "",
    })
  ),
});

export const restoreBackupWithRollback = async ({
  backup,
  safetySnapshot,
  clear,
  write,
  apply,
  onRestoreError,
  onRollbackError,
}) => {
  try {
    await clear();
    await write(backup);
    apply(backup);
  } catch (restoreError) {
    onRestoreError?.(restoreError);

    try {
      await clear();
      await write(safetySnapshot);
      apply(safetySnapshot);
    } catch (rollbackError) {
      onRollbackError?.(rollbackError);
      const combinedError = new Error(
        `Restore failed and automatic rollback also failed. ${
          restoreError?.message || restoreError
        } Rollback error: ${rollbackError?.message || rollbackError}`,
        { cause: rollbackError }
      );
      combinedError.restoreError = restoreError;
      throw combinedError;
    }

    throw restoreError;
  }
};
