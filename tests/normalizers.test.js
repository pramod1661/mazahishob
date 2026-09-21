import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEmiPayment,
  normalizeExpense,
  normalizeLoan,
  normalizePrepaymentPayment,
} from "../src/domain/normalizers.js";

test("database snake_case financial rows normalize to the app model", () => {
  assert.deepEqual(
    normalizeExpense({
      id: 1,
      amount: "125.50",
      category: "Food",
      date: "2026-09-20",
      payment_mode: "UPI",
      created_at: "2026-09-20T10:00:00Z",
    }),
    {
      id: 1,
      amount: 125.5,
      category: "Food",
      date: "2026-09-20",
      payment_mode: "UPI",
      paymentMode: "UPI",
      note: "",
      created_at: "2026-09-20T10:00:00Z",
      createdAt: "2026-09-20T10:00:00Z",
    }
  );

  const loan = normalizeLoan({
    id: 2,
    loan_name: "Home",
    loan_type: "Home Loan",
    outstanding: "90000",
    interest_rate: "8.5",
    emi: "5000",
    tenure: "20",
    next_emi_date: "2026-10-05",
  });

  assert.equal(loan.loanName, "Home");
  assert.equal(loan.outstanding, 90000);
  assert.equal(loan.interestRate, 8.5);
  assert.equal(loan.tenure, 20);
  assert.equal(loan.nextEmiDate, "2026-10-05");
});

test("EMI and prepayment history preserve rollback fields", () => {
  const emi = normalizeEmiPayment({
    id: 3,
    loan_id: 2,
    principal_paid: "4300",
    interest_paid: "700",
    remaining_principal: "90000",
    emi_due_date: "2026-09-05",
    paid_date: "2026-09-05",
  });
  assert.equal(emi.loanId, 2);
  assert.equal(emi.principalPaid, 4300);
  assert.equal(emi.interestPaid, 700);
  assert.equal(emi.emiDueDate, "2026-09-05");

  const prepayment = normalizePrepaymentPayment({
    id: 4,
    loan_id: "2",
    old_outstanding: "100000",
    new_outstanding: "90000",
    old_tenure: "24",
    new_tenure: "20",
    old_status: "Active",
    new_status: "Active",
  });
  assert.equal(prepayment.oldOutstanding, 100000);
  assert.equal(prepayment.newOutstanding, 90000);
  assert.equal(prepayment.oldTenure, 24);
  assert.equal(prepayment.newTenure, 20);
});

