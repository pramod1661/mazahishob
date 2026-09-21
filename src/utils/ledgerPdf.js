import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

const BRAND_BLUE = [20, 74, 116];
const INCOME_GREEN = [22, 120, 72];
const EXPENSE_RED = [184, 54, 54];
const TEXT_DARK = [36, 48, 58];
const TEXT_MUTED = [91, 106, 116];

const cleanText = (value, fallback = "-") => {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
};

export const formatLedgerPdfDate = (dateValue) => {
  const match = String(dateValue || "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : cleanText(dateValue);
};

export const formatLedgerPdfMoney = (value) =>
  `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const buildLedgerPdfFilename = ({ view, periodKey }) => {
  const safeView = view === "yearly" ? "Yearly" : "Monthly";
  const safePeriod = cleanText(periodKey, "Statement").replace(
    /[^a-zA-Z0-9_-]+/g,
    "-"
  );
  return `Maza-Hishob-${safeView}-Statement-${safePeriod}.pdf`;
};

export const createLedgerStatementPdf = async ({
  view,
  periodLabel,
  periodKey,
  entries,
  summary,
  generatedAt = new Date(),
}) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const rows = Array.isArray(entries) ? entries : [];
  const statementSummary = summary || {};
  const title = `${view === "yearly" ? "Yearly" : "Monthly"} Expense Statement`;
  const filename = buildLedgerPdfFilename({ view, periodKey });
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  doc.setProperties({
    title: filename.replace(/\.pdf$/i, ""),
    subject: `${title} for ${cleanText(periodLabel)}`,
    author: "Maza Hishob",
    creator: "Maza Hishob",
  });

  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageWidth, 27, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MAZA HISHOB", margin, 11);
  doc.setFontSize(11);
  doc.text(title, margin, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Period: ${cleanText(periodLabel)}`, pageWidth - margin, 11, {
    align: "right",
  });
  doc.text(
    `Generated: ${generatedAt.toLocaleString("en-IN")}`,
    pageWidth - margin,
    19,
    { align: "right" }
  );

  const cards = [
    ["Carry Forward", statementSummary.carryForward],
    ["Total Income", statementSummary.income],
    ["Total Expense", statementSummary.expense],
    ["Closing Balance", statementSummary.balance],
  ];
  const gap = 3;
  const cardWidth = (pageWidth - margin * 2 - gap * 3) / 4;

  cards.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + gap);
    doc.setFillColor(246, 249, 251);
    doc.setDrawColor(220, 228, 234);
    doc.roundedRect(x, 31, cardWidth, 16, 2, 2, "FD");
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(label, x + 3, 36.5);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(formatLedgerPdfMoney(value), x + 3, 43);
  });

  autoTable(doc, {
    startY: 51,
    tableWidth: pageWidth - margin * 2,
    margin: { left: margin, right: margin, bottom: 14 },
    theme: "grid",
    head: [
      [
        "Date",
        "Type",
        "Entry Name / Description",
        "Category / Source",
        "Payment Mode",
        "Amount",
      ],
    ],
    body: rows.map((entry) => [
      formatLedgerPdfDate(entry.date),
      cleanText(entry.type),
      cleanText(entry.entryName),
      cleanText(entry.category),
      cleanText(entry.paymentMode),
      `${entry.type === "Income" ? "+" : "-"} ${formatLedgerPdfMoney(
        entry.amount
      )}`,
    ]),
    headStyles: {
      fillColor: BRAND_BLUE,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      textColor: TEXT_DARK,
      fontSize: 7.5,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [249, 251, 252] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 22 },
      2: { cellWidth: 80 },
      3: { cellWidth: 56 },
      4: { cellWidth: 40 },
      5: { cellWidth: 51, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;
      data.cell.styles.textColor =
        rows[data.row.index]?.type === "Income" ? INCOME_GREEN : EXPENSE_RED;
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(220, 228, 234);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`${rows.length} individual entries`, margin, pageHeight - 5.5);
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 5.5, {
      align: "right",
    });
  }

  return { doc, filename };
};

export const exportLedgerStatementPdf = async (options) => {
  const { doc, filename } = await createLedgerStatementPdf(options);

  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return { filename, destination: "download" };
  }

  const dataUri = doc.output("datauristring");
  const base64Data = dataUri.slice(dataUri.indexOf(",") + 1);
  const savedFile = await Filesystem.writeFile({
    path: `reports/${filename}`,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title: filename.replace(/\.pdf$/i, ""),
    text: `Maza Hishob statement for ${cleanText(options.periodLabel)}`,
    url: savedFile.uri,
    dialogTitle: "Save or share PDF",
  });

  return { filename, destination: "share" };
};
