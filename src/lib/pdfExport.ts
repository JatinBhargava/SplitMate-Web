import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Settlement, MemberBalance } from "./splitCalculator";

interface ExpenseRow {
  description: string;
  amount: number;
  paidByName: string;
  splitAmongNames: string[];
  date: string;
}

export function exportExpensesPdf(
  groupName: string,
  groupCode: string,
  expenses: ExpenseRow[],
  balances: MemberBalance[],
  settlements: Settlement[]
) {
  const doc = new jsPDF();
  const rupee = "Rs.";
  const brandColor: [number, number, number] = [39, 145, 120];

  doc.setFontSize(20);
  doc.text(`${groupName}`, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Group Code: ${groupCode}`, 14, 28);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

  doc.setFontSize(22);
  doc.setTextColor(...brandColor);
  doc.text("SplitMate", doc.internal.pageSize.getWidth() - 14, 20, { align: "right" });

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Expenses", 14, 46);

  autoTable(doc, {
    startY: 50,
    head: [["Description", "Amount", "Paid By", "Split Among", "Date"]],
    body: expenses.map((e) => [
      e.description,
      `${rupee}${e.amount.toFixed(2)}`,
      e.paidByName,
      e.splitAmongNames.join(", "),
      e.date,
    ]),
    theme: "striped",
    headStyles: { fillColor: [39, 145, 120] },
  });

  const finalY1 = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text("Member Balances", 14, finalY1);

  autoTable(doc, {
    startY: finalY1 + 4,
    head: [["Member", "Total Paid", "Total Owed", "Balance"]],
    body: balances.map((b) => [
      b.memberName,
      `${rupee}${b.totalPaid.toFixed(2)}`,
      `${rupee}${b.totalOwed.toFixed(2)}`,
      `${b.balance >= 0 ? "+" : ""}${rupee}${b.balance.toFixed(2)}`,
    ]),
    theme: "striped",
    headStyles: { fillColor: [39, 145, 120] },
  });

  if (settlements.length > 0) {
    const finalY2 = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Settlements", 14, finalY2);

    autoTable(doc, {
      startY: finalY2 + 4,
      head: [["From", "To", "Amount"]],
      body: settlements.map((s) => [
        s.fromName,
        s.toName,
        `${rupee}${s.amount.toFixed(2)}`,
      ]),
      theme: "striped",
      headStyles: { fillColor: [39, 145, 120] },
    });
  }

  addFooter(doc, brandColor);
  doc.save(`${groupName.replace(/\s+/g, "_")}_expenses.pdf`);
}

interface BudgetExportData {
  budgetName: string;
  budgetType: string;
  budgetLimit: number | null;
  memberNames: string[];
  totalIncome: number;
  totalExpenses: number;
  incomeEntries: { description: string; amount: number; addedBy: string; date: string }[];
  linkedExpenses: { description: string; amount: number; paidBy: string; date: string }[];
}

export function exportBudgetPdf(groupName: string, budget: BudgetExportData) {
  const doc = new jsPDF();
  const rupee = "Rs.";
  const brandColor: [number, number, number] = [39, 145, 120];

  // Header
  doc.setFontSize(20);
  doc.text(budget.budgetName, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Group: ${groupName} | Type: ${budget.budgetType}`, 14, 28);
  if (budget.budgetType === "group") {
    doc.text(`Members: ${budget.memberNames.join(", ")}`, 14, 34);
  }
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, budget.budgetType === "group" ? 40 : 34);

  doc.setFontSize(22);
  doc.setTextColor(...brandColor);
  doc.text("SplitMate", doc.internal.pageSize.getWidth() - 14, 20, { align: "right" });

  // Budget Summary
  let y = budget.budgetType === "group" ? 52 : 46;
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Budget Summary", 14, y);

  const remaining = budget.budgetLimit
    ? budget.budgetLimit - budget.totalExpenses
    : budget.totalIncome - budget.totalExpenses;

  const summaryRows: string[][] = [
    ["Total Income", `${rupee}${budget.totalIncome.toFixed(2)}`],
    ["Total Expenses", `${rupee}${budget.totalExpenses.toFixed(2)}`],
  ];
  if (budget.budgetLimit) {
    summaryRows.push(["Budget Limit", `${rupee}${budget.budgetLimit.toFixed(2)}`]);
    summaryRows.push(["Remaining (from limit)", `${remaining >= 0 ? "+" : ""}${rupee}${remaining.toFixed(2)}`]);
  } else {
    summaryRows.push(["Balance (Income - Expenses)", `${remaining >= 0 ? "+" : ""}${rupee}${remaining.toFixed(2)}`]);
  }

  autoTable(doc, {
    startY: y + 4,
    head: [["Metric", "Value"]],
    body: summaryRows,
    theme: "striped",
    headStyles: { fillColor: [39, 145, 120] },
    columnStyles: { 0: { fontStyle: "bold" } },
  });

  // Income entries
  if (budget.incomeEntries.length > 0) {
    const iy = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.text("Income Entries", 14, iy);
    autoTable(doc, {
      startY: iy + 4,
      head: [["Description", "Amount", "Added By", "Date"]],
      body: budget.incomeEntries.map((e) => [
        e.description,
        `${rupee}${e.amount.toFixed(2)}`,
        e.addedBy,
        e.date,
      ]),
      theme: "striped",
      headStyles: { fillColor: [39, 145, 120] },
    });
  }

  // Linked expenses
  if (budget.linkedExpenses.length > 0) {
    const ey = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.text("Linked Expenses", 14, ey);
    autoTable(doc, {
      startY: ey + 4,
      head: [["Description", "Amount", "Paid By", "Date"]],
      body: budget.linkedExpenses.map((e) => [
        e.description,
        `${rupee}${e.amount.toFixed(2)}`,
        e.paidBy,
        e.date,
      ]),
      theme: "striped",
      headStyles: { fillColor: [39, 145, 120] },
    });
  }

  addFooter(doc, brandColor);
  doc.save(`${budget.budgetName.replace(/\s+/g, "_")}_budget.pdf`);
}

function addFooter(doc: jsPDF, brandColor: [number, number, number]) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(9);
    doc.setTextColor(...brandColor);
    doc.text("splitmate.sanidhya.in", pageWidth / 2, pageHeight - 10, { align: "center" });
  }
}
