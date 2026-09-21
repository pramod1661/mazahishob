import assert from "node:assert/strict";
import test from "node:test";

import {
  addMonthsClamped,
  calculateEmiSettlement,
  calculateRemainingTenure,
} from "../src/domain/loanCalculations.js";

test("month-end EMI dates stay on a valid calendar date", () => {
  assert.equal(addMonthsClamped("2026-01-31"), "2026-02-28");
  assert.equal(addMonthsClamped("2028-01-31"), "2028-02-29");
  assert.equal(addMonthsClamped("2026-12-31"), "2027-01-31");
  assert.equal(addMonthsClamped("2026-03-31", -1), "2026-02-28");
  assert.throws(() => addMonthsClamped("2026-02-31"), /valid EMI due date/);
});

test("standard EMI splits interest and principal and advances due date", () => {
  const result = calculateEmiSettlement({
    outstanding: 100000,
    annualInterestRate: 12,
    emi: 10000,
    dueDate: "2026-01-31",
    fallbackTenure: 12,
  });

  assert.deepEqual(result, {
    interest: 1000,
    principal: 9000,
    actualPaymentAmount: 10000,
    newOutstanding: 91000,
    remainingTenure: 10,
    nextDate: "2026-02-28",
    status: "Active",
  });
});

test("final EMI never overpays and closes the loan", () => {
  const result = calculateEmiSettlement({
    outstanding: 500,
    annualInterestRate: 12,
    emi: 1000,
    dueDate: "2026-05-15",
    fallbackTenure: 1,
  });

  assert.equal(result.interest, 5);
  assert.equal(result.principal, 500);
  assert.equal(result.actualPaymentAmount, 505);
  assert.equal(result.newOutstanding, 0);
  assert.equal(result.remainingTenure, 0);
  assert.equal(result.nextDate, null);
  assert.equal(result.status, "Closed");
});

test("non-amortizing EMI keeps the known tenure instead of producing NaN", () => {
  assert.equal(
    calculateRemainingTenure({
      outstanding: 100000,
      monthlyRate: 0.02,
      emi: 1500,
      fallbackTenure: 36,
    }),
    36
  );
});
