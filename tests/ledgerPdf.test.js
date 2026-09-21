import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLedgerPdfFilename,
  createLedgerStatementPdf,
  formatLedgerPdfDate,
  formatLedgerPdfMoney,
} from "../src/utils/ledgerPdf.js";

test("PDF helpers produce stable financial labels and a safe filename", () => {
  assert.equal(formatLedgerPdfDate("2026-09-20"), "20-09-2026");
  assert.equal(formatLedgerPdfMoney(123456.5), "INR 1,23,456.50");
  assert.equal(
    buildLedgerPdfFilename({ view: "monthly", periodKey: "2026/09" }),
    "Maza-Hishob-Monthly-Statement-2026-09.pdf"
  );
});

test("monthly ledger creates a real, multi-page PDF document", async () => {
  const entries = Array.from({ length: 90 }, (_, index) => ({
    date: `2026-09-${String((index % 28) + 1).padStart(2, "0")}`,
    type: index % 3 === 0 ? "Income" : "Expense",
    entryName: `Test entry ${index + 1}`,
    category: index % 3 === 0 ? "Salary" : "Food",
    paymentMode: index % 2 === 0 ? "UPI" : "Bank Transfer",
    amount: 100 + index,
  }));

  const { doc, filename } = await createLedgerStatementPdf({
    view: "monthly",
    periodLabel: "September 2026",
    periodKey: "2026-09",
    entries,
    summary: {
      carryForward: 1000,
      income: 50000,
      expense: 22500,
      balance: 28500,
    },
    generatedAt: new Date("2026-09-20T10:00:00Z"),
  });

  assert.equal(filename, "Maza-Hishob-Monthly-Statement-2026-09.pdf");
  assert.ok(doc.getNumberOfPages() > 1);
  assert.ok(doc.output("arraybuffer").byteLength > 5000);
});
