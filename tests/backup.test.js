import assert from "node:assert/strict";
import test from "node:test";

import {
  mapBackupToDatabaseRows,
  restoreBackupWithRollback,
  validateBackupData,
} from "../src/domain/backup.js";

const makeBackup = (label, ownerEmail = "owner@example.com") => ({
  app: "Maza Hishob",
  schemaVersion: 3,
  ownerEmail,
  expenses: [{ id: 1, amount: "125", category: "Food", note: label }],
  incomes: [{ id: 2, amount: "1000", source: "Salary" }],
  loans: [
    {
      id: 3,
      loanName: "Home",
      loanType: "Home Loan",
      outstanding: "90000",
      interestRate: "8.5",
      emi: "5000",
      tenure: "20",
      nextEmiDate: "2026-10-05",
    },
  ],
  emiPayments: [
    {
      id: 4,
      loanId: 3,
      amount: "5000",
      emiDueDate: "2026-09-05",
      principalPaid: "4300",
      interestPaid: "700",
      remainingPrincipal: "90000",
    },
  ],
  prepaymentPayments: [
    {
      id: 5,
      loanId: 3,
      amount: "10000",
      oldOutstanding: "100000",
      newOutstanding: "90000",
    },
  ],
});

test("backup validation accepts the owner case-insensitively and blocks another owner", () => {
  const backup = makeBackup("current", "Owner@Example.com");
  assert.equal(validateBackupData(backup, "owner@example.com"), backup);
  assert.throws(
    () => validateBackupData(backup, "someone@example.com"),
    /belongs to Owner@Example\.com/
  );
  assert.throws(() => validateBackupData({ expenses: [] }), /Invalid/);
});

test("backup rows preserve IDs and normalize every financial table", () => {
  const rows = mapBackupToDatabaseRows(
    makeBackup("mapped"),
    "user-123",
    "2026-09-20"
  );

  assert.equal(rows.expenses[0].id, 1);
  assert.equal(rows.expenses[0].user_id, "user-123");
  assert.equal(rows.expenses[0].amount, 125);
  assert.equal(rows.loans[0].loan_name, "Home");
  assert.equal(rows.loans[0].outstanding, 90000);
  assert.equal(rows.emiPayments[0].principal_paid, 4300);
  assert.equal(rows.prepaymentPayments[0].loan_id, "3");
  assert.equal(rows.prepaymentPayments[0].new_outstanding, 90000);
});

test("failed restore automatically writes and applies the safety snapshot", async () => {
  const backup = makeBackup("replacement");
  const safetySnapshot = makeBackup("original");
  let stored = safetySnapshot;
  let applied = safetySnapshot;
  let firstWrite = true;

  await assert.rejects(
    restoreBackupWithRollback({
      backup,
      safetySnapshot,
      clear: async () => {
        stored = null;
      },
      write: async (data) => {
        if (firstWrite) {
          firstWrite = false;
          throw new Error("simulated restore write failure");
        }
        stored = data;
      },
      apply: (data) => {
        applied = data;
      },
    }),
    /simulated restore write failure/
  );

  assert.equal(stored, safetySnapshot);
  assert.equal(applied, safetySnapshot);
});

test("a rollback failure is surfaced with the original restore error as its cause", async () => {
  const restoreError = new Error("restore failed");
  let writes = 0;

  await assert.rejects(
    restoreBackupWithRollback({
      backup: makeBackup("replacement"),
      safetySnapshot: makeBackup("original"),
      clear: async () => {},
      write: async () => {
        writes += 1;
        throw writes === 1 ? restoreError : new Error("rollback failed");
      },
      apply: () => {},
    }),
    (error) => {
      assert.match(error.message, /automatic rollback also failed/);
      assert.match(error.message, /rollback failed/);
      assert.equal(error.restoreError, restoreError);
      assert.match(error.cause.message, /rollback failed/);
      return true;
    }
  );
});
