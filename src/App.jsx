import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./lib/supabase";

const categories = [
  "Food",
  "Grocery",
  "Bills",
  "Travel",
  "Shopping",
  "Medical",
  "Other",
];

const incomeSources = [
  "Salary",
  "Business",
  "Freelance",
  "Bonus",
  "Interest",
  "Other",
];

const loanTypes = [
  "Home Loan",
  "Personal Loan",
  "Car Loan",
  "Education Loan",
  "Gold Loan",
  "Other Loan",
];

const paymentModes = [
  "Cash",
  "UPI",
  "Debit Card",
  "Credit Card",
  "Bank Transfer",
];

const getToday = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const getMonthKey = (date) => String(date || "").slice(0, 7);

const money = (n) =>
  `₹ ${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function App() {
  const [activePage, setActivePage] = useState("home");
  const [month, setMonth] = useState(getMonthKey(getToday()));

  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [loans, setLoans] = useState([]);
  const [emiPayments, setEmiPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterMode, setFilterMode] = useState("All");

  const [selectedLoan, setSelectedLoan] = useState(null);
  const [backupMessage, setBackupMessage] = useState("");

  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    category: "Food",
    date: getToday(),
    paymentMode: "Cash",
    note: "",
  });

  const [incomeForm, setIncomeForm] = useState({
    amount: "",
    source: "Salary",
    date: getToday(),
    paymentMode: "Bank Transfer",
    note: "",
  });

  const [loanForm, setLoanForm] = useState({
    loanType: "Home Loan",
    loanName: "",
    lender: "",
    amount: "",
    outstanding: "",
    interestRate: "",
    emi: "",
    tenure: "",
    startDate: getToday(),
    nextEmiDate: "",
    note: "",
  });

  const [prepayForm, setPrepayForm] = useState({
    outstanding: "",
    interestRate: "",
    emi: "",
    remainingTenure: "",
    prepayment: "",
    option: "tenure",
  });

  /* =========================
     LOAD DATA FROM SUPABASE
  ========================= */

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);

    try {
      const [
        expensesResult,
        incomesResult,
        loansResult,
        emiResult,
      ] = await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("incomes")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("loans")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("emi_payments")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (expensesResult.error) throw expensesResult.error;
      if (incomesResult.error) throw incomesResult.error;
      if (loansResult.error) throw loansResult.error;
      if (emiResult.error) throw emiResult.error;

      setExpenses(
        (expensesResult.data || []).map(normalizeExpense)
      );

      setIncomes(
        (incomesResult.data || []).map(normalizeIncome)
      );

      setLoans(
        (loansResult.data || []).map(normalizeLoan)
      );

      setEmiPayments(
        (emiResult.data || []).map(normalizeEmiPayment)
      );
    } catch (error) {
      console.error("Supabase loading error:", error);
      alert(
        `Unable to load data from Supabase.\n\n${error.message || error}`
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     NORMALIZERS
  ========================= */

  const normalizeExpense = (x) => ({
    ...x,
    id: x.id,
    amount: Number(x.amount || 0),
    category: x.category || "Other",
    date: x.date || getToday(),
    paymentMode: x.payment_mode || x.paymentMode || "Cash",
    note: x.note || "",
    createdAt: x.created_at || x.createdAt || x.created_at,
  });

  const normalizeIncome = (x) => ({
    ...x,
    id: x.id,
    amount: Number(x.amount || 0),
    source: x.source || "Other",
    date: x.date || getToday(),
    paymentMode:
      x.payment_mode ||
      x.paymentMode ||
      "Bank Transfer",
    note: x.note || "",
    createdAt: x.created_at || x.createdAt,
  });

  const normalizeLoan = (x) => ({
    ...x,
    id: x.id,
    loanType: x.loan_type || x.loanType || "Other Loan",
    loanName: x.loan_name || x.loanName || "",
    lender: x.lender || "",
    amount: Number(x.amount || 0),
    outstanding: Number(
      x.outstanding ?? x.amount ?? 0
    ),
    interestRate: Number(
      x.interest_rate ?? x.interestRate ?? 0
    ),
    emi: Number(x.emi || 0),
    tenure: Number(
      x.tenure ?? x.remaining_tenure ?? 0
    ),
    startDate: x.start_date || x.startDate || "",
    nextEmiDate:
      x.next_emi_date ||
      x.nextEmiDate ||
      "",
    note: x.note || "",
    status: x.status || "Active",
    createdAt: x.created_at || x.createdAt,
  });

  const normalizeEmiPayment = (x) => ({
    ...x,
    id: x.id,
    loanId: x.loan_id || x.loanId,
    loanName: x.loan_name || x.loanName || "",
    amount: Number(x.amount || 0),

    principalPaid: Number(
    x.principal_paid ||
      x.principalPaid ||
      0
      ),

      interestPaid: Number(
      x.interest_paid ||
      x.interestPaid ||
      0
      ),

      remainingPrincipal: Number(
      x.remaining_principal ||
      x.remainingPrincipal ||
      0
      ),

    paidDate:
      x.paid_date ||
      x.paidDate ||
      getToday(),
      emiDueDate:
  x.emi_due_date ||
  x.emiDueDate ||
  "",
    createdAt: x.created_at || x.createdAt,
  });

  /* =========================
     CALCULATIONS
  ========================= */

  const monthExpenses = useMemo(
    () =>
      expenses.filter(
        (x) => getMonthKey(x.date) === month
      ),
    [expenses, month]
  );

  const monthIncomes = useMemo(
    () =>
      incomes.filter(
        (x) => getMonthKey(x.date) === month
      ),
    [incomes, month]
  );

  const totalExpenses = expenses.reduce(
    (s, x) => s + Number(x.amount || 0),
    0
  );

  const totalIncome = incomes.reduce(
    (s, x) => s + Number(x.amount || 0),
    0
  );

  const monthExpenseTotal = monthExpenses.reduce(
    (s, x) => s + Number(x.amount || 0),
    0
  );

  const monthIncomeTotal = monthIncomes.reduce(
    (s, x) => s + Number(x.amount || 0),
    0
  );

  const totalBalance =
    totalIncome - totalExpenses;

  const monthSavings =
    monthIncomeTotal - monthExpenseTotal;

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();

    return expenses.filter((x) => {
      const matchesSearch =
        !q ||
        String(x.category)
          .toLowerCase()
          .includes(q) ||
        String(x.note || "")
          .toLowerCase()
          .includes(q);

      const matchesCategory =
        filterCategory === "All" ||
        x.category === filterCategory;

      const matchesMode =
        filterMode === "All" ||
        x.paymentMode === filterMode;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesMode
      );
    });
  }, [
    expenses,
    search,
    filterCategory,
    filterMode,
  ]);

  const categoryTotals = useMemo(() => {
    return categories
      .map((category) => ({
        category,
        amount: monthExpenses
          .filter(
            (x) => x.category === category
          )
          .reduce(
            (s, x) =>
              s + Number(x.amount || 0),
            0
          ),
      }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  const monthLabel = new Date(
    `${month}-01T00:00:00`
  ).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  /* =========================
     EXPENSE
  ========================= */

  const openExpense = (item = null) => {
    setEditing(item);

    setExpenseForm(
      item
        ? {
            amount: item.amount,
            category: item.category,
            date: item.date,
            paymentMode:
              item.paymentMode,
            note: item.note || "",
          }
        : {
            amount: "",
            category: "Food",
            date: getToday(),
            paymentMode: "Cash",
            note: "",
          }
    );

    setModal("expense");
  };

  const saveExpense = async (e) => {
    e.preventDefault();

    if (
      !expenseForm.amount ||
      Number(expenseForm.amount) <= 0
    ) {
      alert("Please enter a valid amount.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        date: expenseForm.date,
        payment_mode:
          expenseForm.paymentMode,
        note: expenseForm.note || "",
      };

      if (editing) {
        const { data, error } =
          await supabase
            .from("expenses")
            .update(payload)
            .eq("id", editing.id)
            .select()
            .single();

        if (error) throw error;

        setExpenses((prev) =>
          prev.map((x) =>
            x.id === editing.id
              ? normalizeExpense(data)
              : x
          )
        );
      } else {
        const { data, error } =
          await supabase
            .from("expenses")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        setExpenses((prev) => [
          normalizeExpense(data),
          ...prev,
        ]);
      }

      closeModal();
    } catch (error) {
      console.error(error);
      alert(
        `Unable to save expense.\n\n${
          error.message || error
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?"))
      return;

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setExpenses((prev) =>
        prev.filter((x) => x.id !== id)
      );
    } catch (error) {
      alert(
        `Unable to delete expense.\n\n${
          error.message || error
        }`
      );
    }
  };

  /* =========================
     INCOME
  ========================= */

  const openIncome = (item = null) => {
    setEditing(item);

    setIncomeForm(
      item
        ? {
            amount: item.amount,
            source: item.source,
            date: item.date,
            paymentMode:
              item.paymentMode,
            note: item.note || "",
          }
        : {
            amount: "",
            source: "Salary",
            date: getToday(),
            paymentMode:
              "Bank Transfer",
            note: "",
          }
    );

    setModal("income");
  };

  const saveIncome = async (e) => {
    e.preventDefault();

    if (
      !incomeForm.amount ||
      Number(incomeForm.amount) <= 0
    ) {
      alert("Please enter a valid income amount.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        amount: Number(incomeForm.amount),
        source: incomeForm.source,
        date: incomeForm.date,
        payment_mode:
          incomeForm.paymentMode,
        note: incomeForm.note || "",
      };

      if (editing) {
        const { data, error } =
          await supabase
            .from("incomes")
            .update(payload)
            .eq("id", editing.id)
            .select()
            .single();

        if (error) throw error;

        setIncomes((prev) =>
          prev.map((x) =>
            x.id === editing.id
              ? normalizeIncome(data)
              : x
          )
        );
      } else {
        const { data, error } =
          await supabase
            .from("incomes")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        setIncomes((prev) => [
          normalizeIncome(data),
          ...prev,
        ]);
      }

      closeModal();
    } catch (error) {
      alert(
        `Unable to save income.\n\n${
          error.message || error
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteIncome = async (id) => {
    if (!window.confirm("Delete this income?"))
      return;

    try {
      const { error } = await supabase
        .from("incomes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setIncomes((prev) =>
        prev.filter((x) => x.id !== id)
      );
    } catch (error) {
      alert(
        `Unable to delete income.\n\n${
          error.message || error
        }`
      );
    }
  };

  /* =========================
     LOANS
  ========================= */

  const openLoan = (loan = null) => {
    setEditing(loan);

    setLoanForm(
      loan
        ? {
            loanType:
              loan.loanType ||
              "Home Loan",
            loanName:
              loan.loanName || "",
            lender:
              loan.lender || "",
            amount:
              loan.amount || "",
            outstanding:
              loan.outstanding ??
              loan.amount ??
              "",
            interestRate:
              loan.interestRate || "",
            emi:
              loan.emi || "",
            tenure:
              loan.tenure || "",
            startDate:
              loan.startDate ||
              getToday(),
            nextEmiDate:
              loan.nextEmiDate || "",
            note:
              loan.note || "",
          }
        : {
            loanType: "Home Loan",
            loanName: "",
            lender: "",
            amount: "",
            outstanding: "",
            interestRate: "",
            emi: "",
            tenure: "",
            startDate: getToday(),
            nextEmiDate: "",
            note: "",
          }
    );

    setModal("loan");
  };

  const saveLoan = async (e) => {
    e.preventDefault();

    if (
      !loanForm.loanName.trim() ||
      !loanForm.amount ||
      !loanForm.emi
    ) {
      alert(
        "Please enter Loan Name, Amount and EMI."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        loan_type:
          loanForm.loanType,
        loan_name:
          loanForm.loanName.trim(),
        lender:
          loanForm.lender.trim(),
        amount:
          Number(loanForm.amount),
        outstanding:
          Number(
            loanForm.outstanding ||
              loanForm.amount
          ),
        interest_rate:
          Number(
            loanForm.interestRate || 0
          ),
        emi:
          Number(loanForm.emi),
        tenure:
          Number(loanForm.tenure || 0),
        start_date:
          loanForm.startDate || null,
        next_emi_date:
          loanForm.nextEmiDate || null,
        note:
          loanForm.note.trim(),
        status:
          editing?.status || "Active",
      };

      if (editing) {
        const { data, error } =
          await supabase
            .from("loans")
            .update(payload)
            .eq("id", editing.id)
            .select()
            .single();

        if (error) throw error;

        setLoans((prev) =>
          prev.map((x) =>
            x.id === editing.id
              ? normalizeLoan(data)
              : x
          )
        );
      } else {
        const { data, error } =
          await supabase
            .from("loans")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        setLoans((prev) => [
          normalizeLoan(data),
          ...prev,
        ]);
      }

      closeModal();
    } catch (error) {
      alert(
        `Unable to save loan.\n\n${
          error.message || error
        }`
      );
    } finally {
      setSaving(false);
    }
  };

 const deleteLoan = async (id) => {
  if (
    !window.confirm(
      "Delete this loan and all its EMI payment history?"
    )
  ) {
    return;
  }

  try {
    setSaving(true);

    /* -----------------------------------------
       1. DELETE EMI PAYMENT HISTORY
    ----------------------------------------- */

    const {
      error: paymentError,
    } = await supabase
      .from("emi_payments")
      .delete()
      .eq("loan_id", id);

    if (paymentError) {
      throw paymentError;
    }

    /* -----------------------------------------
       2. DELETE LOAN
    ----------------------------------------- */

    const {
      error: loanError,
    } = await supabase
      .from("loans")
      .delete()
      .eq("id", id);

    if (loanError) {
      throw loanError;
    }

    /* -----------------------------------------
       3. UPDATE LOCAL EMI HISTORY
    ----------------------------------------- */

    setEmiPayments((prev) =>
      prev.filter(
        (x) => x.loanId !== id
      )
    );

    /* -----------------------------------------
       4. UPDATE LOCAL LOANS
    ----------------------------------------- */

    setLoans((prev) =>
      prev.filter(
        (x) => x.id !== id
      )
    );

  } catch (error) {
    alert(
      `Unable to delete loan.\n\n${
        error.message || error
      }`
    );
  } finally {
    setSaving(false);
  }
};

  /* =========================
     EMI
  ========================= */

 const addMonth = (date, months = 1) => {
  const getNextFutureEmiDate = (
  nextEmiDate
) => {
  if (!nextEmiDate) return null;

  const today = getToday();
  let date = String(nextEmiDate).slice(
    0,
    10
  );

  while (date <= today) {
    date = addMonth(date);
  }

  return date;
};
  const [year, month, day] = String(
    date
  )
    .slice(0, 10)
    .split("-")
    .map(Number);

  let newMonth = month + months;
  let newYear = year;

  while (newMonth > 12) {
    newMonth -= 12;
    newYear++;
  }

  while (newMonth < 1) {
    newMonth += 12;
    newYear--;
  }

  const daysInMonth = new Date(
    newYear,
    newMonth,
    0
  ).getDate();

  const safeDay = Math.min(
    day,
    daysInMonth
  );

  return `${newYear}-${String(
    newMonth
  ).padStart(2, "0")}-${String(
    safeDay
  ).padStart(2, "0")}`;
};

  const markEmiPaid = async (loan) => {
    if (
      (loan.status || "Active") ===
      "Closed"
    ) {
      return;
    }

    const currentOutstanding = Number(
      loan.outstanding ??
        loan.amount ??
        0
    );

    const rate =
      Number(loan.interestRate || 0) /
      100 /
      12;

    const emi = Number(loan.emi || 0);

    const interest =
  currentOutstanding * rate;

const principal = Math.min(
  Math.max(emi - interest, 0),
  currentOutstanding
);

const newOutstanding =
  Math.max(
    currentOutstanding -
      principal,
    0
  );

          /* =========================
       ACCURATE REMAINING TENURE
    ========================= */

    let remainingTenure = 0;

    if (newOutstanding > 0 && emi > 0) {
      if (
        rate > 0 &&
        emi > newOutstanding * rate
      ) {
        remainingTenure = Math.ceil(
          -Math.log(
            1 -
              (newOutstanding * rate) /
                emi
          ) /
            Math.log(1 + rate)
        );
      } else if (rate === 0) {
        remainingTenure = Math.ceil(
          newOutstanding / emi
        );
      } else {
        remainingTenure = Number(
          loan.tenure || 0
        );
      }
    }

   const nextDate = loan.nextEmiDate
  ? (
      loan.nextEmiDate < getToday()
        ? addMonth(loan.nextEmiDate)
        : loan.nextEmiDate
    )
  : null;

    try {
      setSaving(true);

      const paymentPayload = {
        loan_id: loan.id,
        loan_name: loan.loanName,
        amount: emi,
        paid_date: getToday(),
        
        
        principal_paid: principal,
        interest_paid: interest,
        remaining_principal: newOutstanding,
      };

      const {
        data: paymentData,
        error: paymentError,
      } = await supabase
        .from("emi_payments")
        .insert(paymentPayload)
        .select()
        .single();

      if (paymentError)
        throw paymentError;

      const loanPayload = {
        outstanding:
          newOutstanding,
        next_emi_date:
          newOutstanding > 0
            ? nextDate
            : null,
        tenure: remainingTenure,

        status:
          newOutstanding <= 0
            ? "Closed"
            : "Active",
      };

      const {
        data: loanData,
        error: loanError,
      } = await supabase
        .from("loans")
        .update(loanPayload)
        .eq("id", loan.id)
        .select()
        .single();

      if (loanError) throw loanError;

      setEmiPayments((prev) => [
        normalizeEmiPayment(
          paymentData
        ),
        ...prev,
      ]);

      setLoans((prev) =>
        prev.map((x) =>
          x.id === loan.id
            ? normalizeLoan(loanData)
            : x
        )
      );
    } catch (error) {
      alert(
        `Unable to mark EMI as paid.\n\n${
          error.message || error
        }`
      );
    } finally {
      setSaving(false);
    }
  };

 const deleteEmiPayment = async (id) => {
  if (
    !window.confirm(
      "Delete this EMI payment history and restore the loan to its previous state?"
    )
  ) {
    return;
  }

  try {
    setSaving(true);

    const payment = emiPayments.find(
      (p) => p.id === id
    );

    if (!payment) {
      throw new Error(
        "EMI payment record not found."
      );
    }

    const loan = loans.find(
   (x) => x.id === payment.loanId
    );


    /* -----------------------------------------
       1. RESTORE OUTSTANDING PRINCIPAL
    ----------------------------------------- */
if (!loan) {
  const {
    error: paymentError,
  } = await supabase
    .from("emi_payments")
    .delete()
    .eq("id", id);

  if (paymentError) {
    throw paymentError;
  }

  setEmiPayments((prev) =>
    prev.filter(
      (x) => x.id !== id
    )
  );

  return;
}

    const restoredOutstanding =
      Math.max(
        Number(
          payment.remainingPrincipal || 0
        ) +
          Number(
            payment.principalPaid || 0
          ),
        0
      );

    /* -----------------------------------------
    /* -----------------------------------------
   2. CALCULATE NEXT EMI DATE

   Deleted EMI was already overdue.
   Therefore, move Next EMI Date to the
   next future monthly EMI date.

   Example:
   Due Date = 2026-08-05
   Today    = 2026-08-16
   Result   = 2026-09-05
----------------------------------------- */

let restoredNextEmiDate = null;

if (restoredOutstanding > 0) {
  const today = new Date();

  const todayString =
    `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

  let baseDate =
    payment.emiDueDate ||
    loan.nextEmiDate ||
    null;

  if (baseDate) {
    /* Keep only YYYY-MM-DD */
    baseDate = String(baseDate).substring(
      0,
      10
    );

    let [year, month, day] =
      baseDate.split("-").map(Number);

    /* If EMI date is already today/past,
       keep moving one month until it is
       a FUTURE date. */

    while (
      `${year}-${String(month).padStart(
        2,
        "0"
      )}-${String(day).padStart(
        2,
        "0"
      )}` <= todayString
    ) {
      month++;

      if (month > 12) {
        month = 1;
        year++;
      }
    }

    restoredNextEmiDate =
      `${year}-${String(month).padStart(
        2,
        "0"
      )}-${String(day).padStart(
        2,
        "0"
      )}`;
  }
}
    /* -----------------------------------------
       3. RECALCULATE REMAINING TENURE
    ----------------------------------------- */

    const rate =
      Number(loan.interestRate || 0) /
      100 /
      12;

    const emi =
      Number(loan.emi || 0);

    let restoredTenure = 0;

    if (
      restoredOutstanding > 0 &&
      emi > 0
    ) {
      if (
        rate > 0 &&
        emi >
          restoredOutstanding * rate
      ) {
        restoredTenure = Math.ceil(
          -Math.log(
            1 -
              (restoredOutstanding *
                rate) /
                emi
          ) /
            Math.log(1 + rate)
        );
      } else if (rate === 0) {
        restoredTenure = Math.ceil(
          restoredOutstanding / emi
        );
      } else {
        restoredTenure =
          Number(loan.tenure || 0) + 1;
      }
    }

    /* -----------------------------------------
       4. PREPARE LOAN UPDATE
    ----------------------------------------- */

    const loanPayload = {
      outstanding:
        restoredOutstanding,

      next_emi_date:
        restoredNextEmiDate,

      tenure:
        restoredTenure,

      status:
        restoredOutstanding > 0
          ? "Active"
          : "Closed",
    };

    /* -----------------------------------------
       5. UPDATE LOAN
    ----------------------------------------- */

    const {
      data: loanData,
      error: loanError,
    } = await supabase
      .from("loans")
      .update(loanPayload)
      .eq("id", loan.id)
      .select()
      .single();

    if (loanError) {
      throw loanError;
    }

    /* -----------------------------------------
       6. DELETE EMI PAYMENT HISTORY
    ----------------------------------------- */

    const {
      error: paymentError,
    } = await supabase
      .from("emi_payments")
      .delete()
      .eq("id", id);

    if (paymentError) {
      throw paymentError;
    }

    /* -----------------------------------------
       7. UPDATE LOAN STATE
    ----------------------------------------- */

    setLoans((prev) =>
      prev.map((x) =>
        x.id === loan.id
          ? normalizeLoan(loanData)
          : x
      )
    );

    /* -----------------------------------------
       8. REMOVE PAYMENT FROM UI
    ----------------------------------------- */

    setEmiPayments((prev) =>
      prev.filter(
        (x) => x.id !== id
      )
    );

  } catch (error) {
    alert(
      `Unable to delete EMI payment.\n\n${
        error.message || error
      }`
    );
  } finally {
    setSaving(false);
  }
};

  /* =========================
     PREPAYMENT
  ========================= */

  const openPrepayment = (loan) => {
    setSelectedLoan(loan);

    setPrepayForm({
      outstanding:
        loan.outstanding ??
        loan.amount ??
        "",
      interestRate:
        loan.interestRate || "",
      emi:
        loan.emi || "",
      remainingTenure:
        loan.tenure || "",
      prepayment: "",
      option: "tenure",
    });

    setModal("prepayment");
  };

  const prepayResult = useMemo(() => {
    const P = Number(
      prepayForm.outstanding
    );

    const rate =
      Number(
        prepayForm.interestRate
      ) /
      100 /
      12;

    const emi = Number(
      prepayForm.emi
    );

    const months = Number(
      prepayForm.remainingTenure
    );

    const pp = Number(
      prepayForm.prepayment
    );

    if (
      !P ||
      !emi ||
      !months ||
      !pp ||
      pp <= 0
    ) {
      return null;
    }

    const principal = Math.max(
      P - pp,
      0
    );

    const oldInterest =
      Math.max(
        emi * months - P,
        0
      );

    let newTenure = months;

    if (principal <= 0) {
      newTenure = 0;
    } else if (
      rate > 0 &&
      emi > principal * rate
    ) {
      newTenure = Math.ceil(
        -Math.log(
          1 -
            (principal * rate) /
              emi
        ) /
          Math.log(1 + rate)
      );
    } else if (rate === 0) {
      newTenure = Math.ceil(
        principal / emi
      );
    }

    const newInterest =
      Math.max(
        emi * newTenure -
          principal,
        0
      );

    const interestSaved =
      Math.max(
        oldInterest -
          newInterest,
        0
      );

    let newEmi = emi;

    if (principal <= 0) {
      newEmi = 0;
    } else if (rate > 0) {
      newEmi =
        (principal * rate) /
        (1 -
          Math.pow(
            1 + rate,
            -months
          ));
    } else {
      newEmi =
        principal / months;
    }

    return {
      principal,
      newTenure,
      interestSaved,
      tenureSaved: Math.max(
        months - newTenure,
        0
      ),
      newEmi,
      emiSaving: Math.max(
        emi - newEmi,
        0
      ),
    };
  }, [prepayForm]);
  const applyPrepayment = async () => {
  if (!selectedLoan || !prepayResult) return;

  const currentOutstanding = Number(
    selectedLoan.outstanding ??
      selectedLoan.amount ??
      0
  );

  const prepaymentAmount = Number(
    prepayForm.prepayment || 0
  );

  if (prepaymentAmount <= 0) {
    alert(
      "Please enter a valid prepayment amount."
    );
    return;
  }

  if (prepaymentAmount > currentOutstanding) {
    alert(
      "Prepayment cannot be greater than outstanding amount."
    );
    return;
  }

  const newOutstanding = Math.max(
    currentOutstanding -
      prepaymentAmount,
    0
  );

  try {
    setSaving(true);

    const payload = {
      outstanding: newOutstanding,
      next_emi_date:
        newOutstanding > 0
          ? selectedLoan.nextEmiDate
          : null,
      tenure:
        newOutstanding > 0
          ? prepayResult.newTenure
          : 0,
      status:
        newOutstanding <= 0
          ? "Closed"
          : "Active",
    };

    const {
      data,
      error,
    } = await supabase
      .from("loans")
      .update(payload)
      .eq("id", selectedLoan.id)
      .select()
      .single();

    if (error) throw error;

    setLoans((prev) =>
      prev.map((x) =>
        x.id === selectedLoan.id
          ? normalizeLoan(data)
          : x
      )
    );

    closeModal();
  } catch (error) {
    alert(
      `Unable to apply prepayment.\n\n${
        error.message || error
      }`
    );
  } finally {
    setSaving(false);
  }
};

  /* =========================
     DASHBOARD
  ========================= */

  const transactions = useMemo(
    () =>
      [
        ...expenses.map((x) => ({
          ...x,
          type: "expense",
          title: x.category,
        })),
        ...incomes.map((x) => ({
          ...x,
          type: "income",
          title: x.source,
        })),
      ]
        .sort(
          (a, b) =>
            new Date(
              b.createdAt || b.date
            ) -
            new Date(
              a.createdAt || a.date
            )
        )
        .slice(0, 8),
    [expenses, incomes]
  );

  const upcomingLoan = useMemo(() => {
    const active = loans.filter(
      (x) =>
        (x.status || "Active") !==
          "Closed" &&
        Number(
          x.outstanding ??
            x.amount ??
            0
        ) > 0
    );

    return (
      [...active].sort(
        (a, b) => {
          if (!a.nextEmiDate)
            return 1;

          if (!b.nextEmiDate)
            return -1;

          return (
            new Date(
              a.nextEmiDate
            ) -
            new Date(
              b.nextEmiDate
            )
          );
        }
      )[0] || null
    );
  }, [loans]);
  // =========================
// PENDING EMI
// =========================

const getPendingEmis = (loan) => {
  if (
    (loan.status || "Active") === "Closed" ||
    !loan.nextEmiDate ||
    Number(
      loan.outstanding ??
        loan.amount ??
        0
    ) <= 0
  ) {
    return [];
  }

  const today = getToday();

  const nextDate = String(
    loan.nextEmiDate
  ).slice(0, 10);

  /* -----------------------------------------
     CASE 1:
     Next EMI itself is overdue
  ----------------------------------------- */

  if (nextDate <= today) {
    const pending = [];

    let dueDate = nextDate;

    while (dueDate <= today) {
      const alreadyPaid =
        emiPayments.some(
          (p) =>
            p.loanId === loan.id &&
            String(
              p.emiDueDate || ""
            ).slice(0, 10) === dueDate
        );

      if (!alreadyPaid) {
        pending.push({
          loanId: loan.id,
          loanName: loan.loanName,
          amount: Number(
            loan.emi || 0
          ),
          dueDate,
        });
      }

      dueDate = addMonth(dueDate);
    }

    return pending;
  }

  /* -----------------------------------------
     CASE 2:
     Next EMI is future.

     Check previous month's EMI.
  ----------------------------------------- */

  const previousEmiDate =
    addMonth(nextDate, -1);

  if (
    previousEmiDate <= today
  ) {
    const alreadyPaid =
      emiPayments.some(
        (p) =>
          p.loanId === loan.id &&
          String(
            p.emiDueDate || ""
          ).slice(0, 10) ===
            previousEmiDate
      );

    if (!alreadyPaid) {
      return [
        {
          loanId: loan.id,
          loanName: loan.loanName,
          amount: Number(
            loan.emi || 0
          ),
          dueDate:
            previousEmiDate,
        },
      ];
    }
  }

  return [];
};
  const getEmiStatus = (loan) => {
  if (
    (loan.status || "Active") === "Closed"
  ) {
    return {
      label: "Closed",
      className: "closed",
    };
  }

  if (!loan.nextEmiDate) {
    return {
      label: "Date Not Set",
      className: "",
    };
  }

  const today = new Date(
    `${getToday()}T00:00:00`
  );

  const emiDate = new Date(
    `${loan.nextEmiDate}T00:00:00`
  );

  const diffDays = Math.ceil(
    (emiDate - today) /
      (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return {
      label: `Overdue by ${Math.abs(
        diffDays
      )} days`,
      className: "overdue",
    };
  }

  if (diffDays === 0) {
    return {
      label: "Due Today",
      className: "due-today",
    };
  }

  if (diffDays <= 7) {
    return {
      label: `Due in ${diffDays} days`,
      className: "due-soon",
    };
  }

  return {
    label: `Due in ${diffDays} days`,
    className: "upcoming",
  };
};

  /* =========================
     BACKUP
  ========================= */

  const exportData = () => {
    const data = {
      expenses,
      incomes,
      loans,
      emiPayments,
      exportedAt:
        new Date().toISOString(),
    };

    const blob = new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        ),
      ],
      {
        type: "application/json",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download = `maza-hishob-backup-${getToday()}.json`;

    a.click();

    URL.revokeObjectURL(url);

    setBackupMessage(
      "Backup downloaded successfully."
    );
  };

  const importData = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      try {
        const d =
          JSON.parse(
            reader.result
          );

        if (
          !Array.isArray(
            d.expenses
          ) ||
          !Array.isArray(
            d.incomes
          ) ||
          !Array.isArray(
            d.loans
          )
        ) {
          throw new Error();
        }

        setExpenses(d.expenses);
        setIncomes(d.incomes);
        setLoans(d.loans);
        setEmiPayments(
          d.emiPayments || []
        );

        setBackupMessage(
          "Backup loaded in the app. Supabase data is not overwritten by this import."
        );
      } catch {
        setBackupMessage(
          "Invalid backup file."
        );
      }
    };

    reader.readAsText(file);

    e.target.value = "";
  };

  const resetAll = async () => {
    if (
      !window.confirm(
        "This will permanently delete all Maza Hishob data from Supabase. Continue?"
      )
    ) {
      return;
    }

    try {
      setSaving(true);

      await supabase
        .from("emi_payments")
        .delete()
        .neq("id", 0);

      await supabase
        .from("expenses")
        .delete()
        .neq("id", 0);

      await supabase
        .from("incomes")
        .delete()
        .neq("id", 0);

      await supabase
        .from("loans")
        .delete()
        .neq("id", 0);

      setExpenses([]);
      setIncomes([]);
      setLoans([]);
      setEmiPayments([]);

      setBackupMessage(
        "All data cleared."
      );
    } catch (error) {
      alert(
        `Unable to reset data.\n\n${
          error.message || error
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setSelectedLoan(null);
  };

  const nav = [
    ["home", "⌂", "Home"],
    ["expenses", "◈", "Daily Expenses"],
    ["loans", "▣", "Loans"],
    ["reports", "◫", "Reports"],
  ];

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-logo">
          MH
        </div>
        <h2>Maza Hishob</h2>
        <p>
          Loading your financial data...
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="brand">
          <div className="brand-mark">
            MH
          </div>

          <div className="brand-text">
            <h1>Maza Hishob</h1>
            <p>
              Complete Financial Tracking
              Solution
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="icon-btn"
            title="Reports"
            onClick={() =>
              setActivePage("reports")
            }
          >
            ◫
          </button>

          <button
            className="profile-btn"
            title="Settings"
            onClick={() =>
              setActivePage("settings")
            }
          >
            ⚙
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-section">
            <span className="sidebar-label">
              MAIN MENU
            </span>

            {nav.map(
              ([key, icon, label]) => (
                <button
                  key={key}
                  className={`side-item ${
                    activePage === key
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setActivePage(key)
                  }
                >
                  <span className="side-icon">
                    {icon}
                  </span>

                  <span>{label}</span>
                </button>
              )
            )}
          </div>

          <div className="sidebar-bottom">
            <button
              className={`side-item ${
                activePage ===
                "settings"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActivePage(
                  "settings"
                )
              }
            >
              <span className="side-icon">
                ⚙
              </span>

              <span>Settings</span>
            </button>

            <button
              className="side-item"
              onClick={() =>
                alert(
                  "Maza Hishob\nYour financial data is stored securely in Supabase."
                )
              }
            >
              <span className="side-icon">
                ?
              </span>

              <span>
                Help & Support
              </span>
            </button>
          </div>
        </aside>

        <main className="main-content">
          {activePage === "home" && (
            <>
              <section className="welcome-section">
                <div>
                  <span className="eyebrow">
                    DASHBOARD
                  </span>

                  <h2>
                    Complete Financial
                    Tracking Solution
                  </h2>

                  <p>
                    Here's your financial
                    overview
                  </p>
                </div>

                <div className="month-picker">
                  <span>
                    Overview
                  </span>

                  <input
                    type="month"
                    value={month}
                    onChange={(e) =>
                      setMonth(
                        e.target.value
                      )
                    }
                  />
                </div>
              </section>

              <section className="balance-card">
                <div className="balance-glow glow-one" />
                <div className="balance-glow glow-two" />

                <div className="balance-header">
                  <div>
                    <span className="balance-label">
                      TOTAL BALANCE
                    </span>

                    <h3>
                      {money(
                        totalBalance
                      )}
                    </h3>
                  </div>

                  <div className="balance-status">
                    <span className="status-dot" />
                    {monthLabel}
                  </div>
                </div>

                <div className="balance-divider" />

                <div className="balance-summary">
                  <div className="balance-stat">
                    <div className="stat-icon income">
                      ↗
                    </div>

                    <div>
                      <span>
                        Income
                      </span>

                      <strong>
                        {money(
                          monthIncomeTotal
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="balance-stat">
                    <div className="stat-icon expense">
                      ↘
                    </div>

                    <div>
                      <span>
                        Expenses
                      </span>

                      <strong>
                        {money(
                          monthExpenseTotal
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="balance-stat">
                    <div className="stat-icon saving">
                      ◇
                    </div>

                    <div>
                      <span>
                        Savings
                      </span>

                      <strong>
                        {money(
                          monthSavings
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className="dashboard-section">
                <div className="section-heading">
                  <div>
                    <span>
                      GET STARTED
                    </span>

                    <h3>
                      Quick Actions
                    </h3>
                  </div>
                </div>

                <div className="quick-actions">
                  <button
                    className="action-card expense-action"
                    onClick={() =>
                      openExpense()
                    }
                  >
                    <div className="action-icon">
                      ↘
                    </div>

                    <div className="action-content">
                      <strong>
                        Add Expense
                      </strong>

                      <span>
                        Track daily
                        spending
                      </span>
                    </div>

                    <span className="card-arrow">
                      →
                    </span>
                  </button>

                  <button
                    className="action-card income-action"
                    onClick={() =>
                      openIncome()
                    }
                  >
                    <div className="action-icon">
                      ↗
                    </div>

                    <div className="action-content">
                      <strong>
                        Add Income
                      </strong>

                      <span>
                        Record your
                        income
                      </span>
                    </div>

                    <span className="card-arrow">
                      →
                    </span>
                  </button>

                  <button
                    className="action-card loan-action"
                    onClick={() =>
                      openLoan()
                    }
                  >
                    <div className="action-icon">
                      ＋
                    </div>

                    <div className="action-content">
                      <strong>
                        Add Loan
                      </strong>

                      <span>
                        Track your
                        loans
                      </span>
                    </div>

                    <span className="card-arrow">
                      →
                    </span>
                  </button>
                </div>
              </section>

              <section className="dashboard-section">
                <div className="section-heading">
                  <div>
                    <span>
                      YOUR FINANCES
                    </span>

                    <h3>
                      Finance Snapshot
                    </h3>
                  </div>
                </div>

                <div className="finance-grid">
                  <button
                    className="finance-card"
                    onClick={() =>
                      setActivePage(
                        "expenses"
                      )
                    }
                  >
                    <div className="finance-card-top">
                      <div className="finance-icon expenses-icon">
                        ◈
                      </div>

                      <span className="card-arrow">
                        →
                      </span>
                    </div>

                    <div className="finance-info">
                      <span>
                        Daily Expenses
                      </span>

                      <strong>
                        {money(
                          totalExpenses
                        )}
                      </strong>

                      <small>
                        Total tracked
                      </small>
                    </div>
                  </button>

                  <button
                    className="finance-card"
                    onClick={() =>
                      setActivePage(
                        "loans"
                      )
                    }
                  >
                    <div className="finance-card-top">
                      <div className="finance-icon loans-icon">
                        ▣
                      </div>

                      <span className="card-arrow">
                        →
                      </span>
                    </div>

                    <div className="finance-info">
                      <span>
                        Loans
                      </span>

                      <strong>
                        {
                          loans.filter(
                            (x) =>
                              (x.status ||
                                "Active") !==
                              "Closed"
                          ).length
                        }
                      </strong>

                      <small>
                        Active Loans
                      </small>
                    </div>
                  </button>
                </div>
              </section>

              <section className="dashboard-section">
                <div className="section-heading">
                  <div>
                    <span>
                      LOAN TRACKING
                    </span>

                    <h3>
                      Upcoming EMI
                    </h3>
                  </div>

                  <button
                    className="view-link"
                    onClick={() =>
                      setActivePage(
                        "loans"
                      )
                    }
                  >
                    View Loans →
                  </button>
                </div>

                {upcomingLoan ? (
                  <div className="emi-card">
                    <div className="emi-icon">
                      ◷
                    </div>

                    <div className="emi-content">
                      <strong>
                        {
                          upcomingLoan.loanName
                        }
                      </strong>

                      <span>
                        EMI{" "}
                        {money(
                          upcomingLoan.emi
                        )}{" "}
                        {upcomingLoan.nextEmiDate
                          ? `• Due ${upcomingLoan.nextEmiDate}`
                          : ""}
                      </span>
                    </div>

                    <button
                      className="paid-btn"
                      disabled={saving}
                      onClick={() =>
                        markEmiPaid(
                          upcomingLoan
                        )
                      }
                    >
                      ✓ Paid
                    </button>
                  </div>
                ) : (
                  <button
                    className="emi-card"
                    onClick={() =>
                      openLoan()
                    }
                  >
                    <div className="emi-icon">
                      ◷
                    </div>

                    <div className="emi-content">
                      <strong>
                        No upcoming EMI
                      </strong>

                      <span>
                        Add a loan to
                        start tracking
                        your EMI
                        payments
                      </span>
                    </div>

                    <span className="card-arrow">
                      →
                    </span>
                  </button>
                )}
              </section>

              <section className="dashboard-section recent-section">
                <div className="section-heading">
                  <div>
                    <span>
                      ACTIVITY
                    </span>

                    <h3>
                      Recent Transactions
                    </h3>
                  </div>

                  <button
                    className="view-link"
                    onClick={() =>
                      setActivePage(
                        "expenses"
                      )
                    }
                  >
                    View All →
                  </button>
                </div>

                {transactions.length ? (
                  <div className="transaction-list">
                    {transactions.map(
                      (t) => (
                        <div
                          className="transaction-item"
                          key={`${t.type}-${t.id}`}
                        >
                          <div
                            className={`transaction-icon ${
                              t.type ===
                              "income"
                                ? "income-transaction"
                                : ""
                            }`}
                          >
                            {t.type ===
                            "income"
                              ? "↗"
                              : "↘"}
                          </div>

                          <div className="transaction-details">
                            <strong>
                              {t.title}
                            </strong>

                            <span>
                              {t.note ||
                                t.paymentMode}
                            </span>
                          </div>

                          <div className="transaction-right">
                            <strong>
                              {t.type ===
                              "income"
                                ? "+"
                                : "-"}{" "}
                              {money(
                                t.amount
                              )}
                            </strong>

                            <span>
                              {t.date}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="empty-transactions">
                    <div className="empty-icon">
                      ◇
                    </div>

                    <h4>
                      No transactions yet
                    </h4>

                    <p>
                      Your recent income
                      and expenses will
                      appear here.
                    </p>

                    <button
                      className="primary-btn"
                      onClick={() =>
                        openExpense()
                      }
                    >
                      ＋ Add Expense
                    </button>
                  </div>
                )}
              </section>
            </>
          )}

          {activePage === "expenses" && (
            <>
              <PageHead
                eyebrow="EXPENSE MANAGEMENT"
                title="Daily Expenses"
                text="Track and manage every expense"
                action="＋ Add Expense"
                onAction={() =>
                  openExpense()
                }
              />

              <div className="stats-row">
                <Stat
                  label="All Expenses"
                  value={money(
                    totalExpenses
                  )}
                  note={`${expenses.length} transactions`}
                />

                <Stat
                  label={`${monthLabel} Expenses`}
                  value={money(
                    monthExpenseTotal
                  )}
                  note={`${monthExpenses.length} transactions`}
                />

                <Stat
                  label="Average Expense"
                  value={money(
                    expenses.length
                      ? totalExpenses /
                          expenses.length
                      : 0
                  )}
                  note="Per transaction"
                />
              </div>

              <div className="filter-bar">
                <input
                  className="form-input"
                  placeholder="🔎 Search category or note..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />

                <select
                  className="form-input"
                  value={
                    filterCategory
                  }
                  onChange={(e) =>
                    setFilterCategory(
                      e.target.value
                    )
                  }
                >
                  <option>
                    All
                  </option>

                  {categories.map(
                    (c) => (
                      <option
                        key={c}
                      >
                        {c}
                      </option>
                    )
                  )}
                </select>

                <select
                  className="form-input"
                  value={filterMode}
                  onChange={(e) =>
                    setFilterMode(
                      e.target.value
                    )
                  }
                >
                  <option>
                    All
                  </option>

                  {paymentModes.map(
                    (m) => (
                      <option
                        key={m}
                      >
                        {m}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="transaction-list">
                {filteredExpenses.length ? (
                  filteredExpenses.map(
                    (x) => (
                      <div
                        className="transaction-item"
                        key={x.id}
                      >
                        <div className="transaction-icon">
                          ↘
                        </div>

                        <div className="transaction-details">
                          <strong>
                            {x.category}
                          </strong>

                          <span>
                            {x.note ||
                              x.paymentMode}
                          </span>
                        </div>

                        <div className="transaction-right">
                          <strong>
                            -{" "}
                            {money(
                              x.amount
                            )}
                          </strong>

                          <span>
                            {x.date}
                          </span>
                        </div>

                        <button
                          className="mini-btn"
                          onClick={() =>
                            openExpense(
                              x
                            )
                          }
                        >
                          ✎
                        </button>

                        <button
                          className="delete-expense"
                          onClick={() =>
                            deleteExpense(
                              x.id
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    )
                  )
                ) : (
                  <div className="empty-transactions">
                    <div className="empty-icon">
                      ◇
                    </div>

                    <h4>
                      No matching
                      expenses
                    </h4>

                    <p>
                      Try another
                      filter or add a
                      new expense.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {activePage === "loans" && (
            <>
              <PageHead
                eyebrow="LOAN MANAGEMENT"
                title="Loans & EMI"
                text="Track outstanding, EMI payments and prepayments"
                action="＋ Add Loan"
                onAction={() =>
                  openLoan()
                }
              />

              <div className="stats-row">
                <Stat
                  label="Active Loans"
                  value={String(
                    loans.filter(
                      (x) =>
                        (x.status ||
                          "Active") !==
                        "Closed"
                    ).length
                  )}
                  note="Currently running"
                />
                <Stat
  label="Original Amount"
  value={money(
    loans.reduce(
      (s, x) =>
        s +
        Number(
          x.amount || 0
        ),
      0
    )
  )}
  note="Total loan amount"
 />

                <Stat
                  label="Monthly EMI"
                  value={money(
                    loans.reduce(
                      (s, x) =>
                        s +
                        Number(
                          x.emi || 0
                        ),
                      0
                    )
                  )}
                  note="Total EMI / month"
                />

                <Stat
                  label="Outstanding"
                  value={money(
                    loans.reduce(
                      (s, x) =>
                        s +
                        Number(
                          x.outstanding ??
                            x.amount ??
                            0
                        ),
                      0
                    )
                  )}
                  note="Current principal"
                />
                <Stat
  label="Interest Paid"
  value={money(
    emiPayments.reduce(
      (s, x) =>
        s +
        Number(
          x.interestPaid || 0
        ),
      0
    )
  )}
  note="Total interest paid"
/>
<Stat
  label="Principal Paid"
  value={money(
    emiPayments.reduce(
      (s, x) =>
        s +
        Number(
          x.principalPaid || 0
        ),
      0
    )
  )}
  note="Total principal paid"
/>
              </div>

              <div className="loan-grid">
                {loans.length ? (
                  loans.map(
                    (loan) => (
                      <div
                        className="loan-card"
                        key={loan.id}
                      >
                        <div className="loan-card-top">
                          <div className="finance-icon loans-icon">
                            ▣
                          </div>

                          <span
                            className={`loan-status ${
                              (loan.status ||
                                "Active") ===
                              "Closed"
                                ? "closed"
                                : ""
                            }`}
                          >
                            {loan.status ||
                              "Active"}
                          </span>
                        </div>

                        <h3>
                          {
                            loan.loanName
                          }
                        </h3>

                        <p>
                          {loan.lender ||
                            loan.loanType}
                        </p>

<div className="loan-numbers">
  <div>
  <span>
    Original Amount
  </span>

  <strong>
    {money(
      loan.amount || 0
    )}
  </strong>
</div>
  <div>
    <span>
      Outstanding
    </span>

    <strong>
      {money(
        loan.outstanding ??
          loan.amount
      )}
    </strong>
  </div>

  <div>
    <span>
      EMI
    </span>

    <strong>
      {money(
        loan.emi
      )}
    </strong>
  </div>

  <div>
    <span>
      Rate
    </span>

    <strong>
      {loan.interestRate ||
        0}
      %
    </strong>
  </div>

  {/* NEW - Remaining Tenure */}
  <div>
    <span>
      Remaining Tenure
    </span>

    <strong>
      {loan.tenure || 0} months
    </strong>
  </div>
  <div>
  <span>
    Principal Paid
  </span>

  <strong>
    {money(
      emiPayments
        .filter(
          (p) => p.loanId === loan.id
        )
        .reduce(
          (s, p) =>
            s +
            Number(
              p.principalPaid || 0
            ),
          0
        )
    )}
  </strong>
</div>

<div>
  <span>
    Interest Paid
  </span>

  <strong>
    {money(
      emiPayments
        .filter(
          (p) => p.loanId === loan.id
        )
        .reduce(
          (s, p) =>
            s +
            Number(
              p.interestPaid || 0
            ),
          0
        )
    )}
  </strong>
</div>
</div>

                        <div className="loan-actions">
                          <button
                            className="primary-btn small"
                            disabled={
                              saving ||
                              (loan.status ||
                                "Active") ===
                                "Closed"
                            }
                            onClick={() =>
                              markEmiPaid(
                                loan
                              )
                            }
                          >
                            ✓ EMI Paid
                          </button>

                          <button
                            className="secondary-btn"
                            onClick={() =>
                              openPrepayment(
                                loan
                              )
                            }
                          >
                            🧮 Prepay
                          </button>

                          <button
                            className="secondary-btn"
                            onClick={() =>
                              openLoan(
                                loan
                              )
                            }
                          >
                            ✎
                          </button>

                          <button
                            className="delete-expense"
                            onClick={() =>
                              deleteLoan(
                                loan.id
                              )
                            }
                          >
                            ×
                          </button>
                        </div>

                        {loan.nextEmiDate && (
  <div className="loan-next">
    <div>
    Next EMI: {
  loan.nextEmiDate &&
  loan.nextEmiDate < getToday()
    ? addMonth(loan.nextEmiDate)
    : loan.nextEmiDate
}
    </div>

    <small
      className={`emi-status ${
        getEmiStatus(loan).className
      }`}
    >
      {getEmiStatus(loan).label}
    </small>
  </div>
)}
{getPendingEmis(loan).length > 0 && (
  <div
    style={{
      marginTop: "10px",
      padding: "10px",
      borderRadius: "10px",
      background: "#fff4f4",
    }}
  >
    <strong>
      🔴 {getPendingEmis(loan).length} EMI Pending
    </strong>

    <div
      style={{
        marginTop: "6px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "12px",
      }}
    >
      {getPendingEmis(loan).map(
        (p) => (
          <div
            key={`${p.loanId}-${p.dueDate}`}
            style={{
              display: "flex",
              justifyContent:
                "space-between",
            }}
          >
            <span>
              Due: {p.dueDate}
            </span>

            <strong>
              {money(p.amount)}
            </strong>
          </div>
        )
      )}
    </div>
  </div>
)}
                      </div>
                    )
                  )
                ) : (
                  <div className="empty-transactions">
                    <div className="empty-icon">
                      ▣
                    </div>

                    <h4>
                      No loans added
                    </h4>

                    <p>
                      Add your home loan
                      or any other loan
                      to start tracking
                      it.
                    </p>

                    <button
                      className="primary-btn"
                      onClick={() =>
                        openLoan()
                      }
                    >
                      ＋ Add Loan
                    </button>
                  </div>
                )}
              </div>

              <section className="dashboard-section">
                <div className="section-heading">
                  <div>
                    <span>
                      HISTORY
                    </span>

                    <h3>
                      EMI Payment
                      History
                    </h3>
                  </div>
                </div>

                {emiPayments.length ? (
                  <div className="transaction-list">
{emiPayments.map(
  (p) => (
    <div
      className="transaction-item"
      key={p.id}
    >
      <div className="transaction-icon">
        ✓
      </div>

      <div className="transaction-details">
        <strong>
          {p.loanName}
        </strong>

        <span>
          EMI Paid
        </span>

        <div
          style={{
            marginTop: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            fontSize: "11px",
          }}
        >
          <span>
            Principal:{" "}
            <strong>
              {money(
                p.principalPaid
              )}
            </strong>
          </span>

          <span>
            Interest:{" "}
            <strong>
              {money(
                p.interestPaid
              )}
            </strong>
          </span>

          <span>
            Remaining Principal:{" "}
            <strong>
              {money(
                p.remainingPrincipal
              )}
            </strong>
          </span>
        </div>
      </div>

      <div className="transaction-right">
        <strong>
          {money(p.amount)}
        </strong>

        <span>
          {p.paidDate}
        </span>
      </div>

      <button
        className="delete-expense"
        onClick={() =>
          deleteEmiPayment(
            p.id
          )
        }
      >
        ×
      </button>
    </div>
  )
)}
                  </div>
                ) : (
                  <p className="muted">
                    No EMI payments
                    recorded yet.
                  </p>
                )}
              </section>
            </>
          )}

          {activePage === "reports" && (
            <>
              <PageHead
                eyebrow="INSIGHTS"
                title="Reports"
                text="Understand where your money is going"
              />

              <div className="month-report-head">
                <input
                  type="month"
                  value={month}
                  onChange={(e) =>
                    setMonth(
                      e.target.value
                    )
                  }
                />

                <strong>
                  {monthLabel}
                </strong>
              </div>

              <div className="stats-row">
                <Stat
                  label="Income"
                  value={money(
                    monthIncomeTotal
                  )}
                  note="Selected month"
                />

                <Stat
                  label="Expenses"
                  value={money(
                    monthExpenseTotal
                  )}
                  note="Selected month"
                />

                <Stat
                  label="Savings"
                  value={money(
                    monthSavings
                  )}
                  note="Income minus expenses"
                />
              </div>

              <section className="report-card">
                <div className="section-heading">
                  <div>
                    <span>
                      BREAKDOWN
                    </span>

                    <h3>
                      Expense Categories
                    </h3>
                  </div>
                </div>

                {categoryTotals.length ? (
                  categoryTotals.map(
                    (x) => (
                      <div
                        className="bar-row"
                        key={
                          x.category
                        }
                      >
                        <div>
                          <span>
                            {
                              x.category
                            }
                          </span>

                          <strong>
                            {money(
                              x.amount
                            )}
                          </strong>
                        </div>

                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${
                                Math.min(
                                  (x.amount /
                                    Math.max(
                                      categoryTotals[0]
                                        .amount,
                                      1
                                    )) *
                                    100,
                                  100
                                )
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <p className="muted">
                    No expenses for
                    this month.
                  </p>
                )}
              </section>

              <section className="report-card">
                <div className="section-heading">
                  <div>
                    <span>
                      LOAN SUMMARY
                    </span>

                    <h3>
                      Debt Snapshot
                    </h3>
                  </div>
                </div>

                <div className="stats-row compact">
                  <Stat
                    label="Loans"
                    value={String(
                      loans.length
                    )}
                    note="Total accounts"
                  />

                  <Stat
                    label="Outstanding"
                    value={money(
                      loans.reduce(
                        (s, x) =>
                          s +
                          Number(
                            x.outstanding ??
                              x.amount ??
                              0
                          ),
                        0
                      )
                    )}
                    note="Current principal"
                  />

                  <Stat
                    label="EMI / Month"
                    value={money(
                      loans.reduce(
                        (s, x) =>
                          s +
                          Number(
                            x.emi ||
                              0
                          ),
                        0
                      )
                    )}
                    note="Total monthly EMI"
                  />
                </div>
              </section>
            </>
          )}

          {activePage === "settings" && (
            <>
              <PageHead
                eyebrow="PREFERENCES"
                title="Settings"
                text="Manage your Maza Hishob data"
              />

              <section className="settings-card">
                <div>
                  <h3>
                    Data Backup
                  </h3>

                  <p>
                    Download a complete
                    copy of your
                    expenses, income,
                    loans and EMI
                    history.
                  </p>
                </div>

                <button
                  className="primary-btn"
                  onClick={exportData}
                >
                  ↓ Export Backup
                </button>
              </section>

              <section className="settings-card">
                <div>
                  <h3>
                    Restore Backup
                  </h3>

                  <p>
                    Import a previously
                    exported JSON
                    backup into this
                    session.
                  </p>
                </div>

                <label className="secondary-btn file-btn">
                  ↑ Import Backup

                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={
                      importData
                    }
                  />
                </label>
              </section>

              <section className="settings-card danger-card">
                <div>
                  <h3>
                    Reset All Data
                  </h3>

                  <p>
                    This permanently
                    clears all Maza
                    Hishob data from
                    Supabase.
                  </p>
                </div>

                <button
                  className="danger-btn"
                  disabled={saving}
                  onClick={
                    resetAll
                  }
                >
                  Reset Data
                </button>
              </section>

              {backupMessage && (
                <div className="success-note">
                  {backupMessage}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ================= EXPENSE MODAL ================= */}

      {modal === "expense" && (
        <Modal
          title={
            editing
              ? "Edit Expense"
              : "Add Expense"
          }
          eyebrow="TRANSACTION"
          subtitle="Record your daily spending"
          onClose={closeModal}
        >
          <form
            onSubmit={saveExpense}
          >
            <AmountInput
              value={
                expenseForm.amount
              }
              onChange={(v) =>
                setExpenseForm(
                  (p) => ({
                    ...p,
                    amount: v,
                  })
                )
              }
            />

            <Field label="Category">
              <div className="category-grid">
                {categories.map(
                  (c) => (
                    <button
                      type="button"
                      key={c}
                      className={`category-option ${
                        expenseForm.category ===
                        c
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setExpenseForm(
                          (p) => ({
                            ...p,
                            category:
                              c,
                          })
                        )
                      }
                    >
                      {c}
                    </button>
                  )
                )}
              </div>
            </Field>

            <div className="form-row">
              <Field label="Date">
                <input
                  className="form-input"
                  type="date"
                  value={
                    expenseForm.date
                  }
                  onChange={(e) =>
                    setExpenseForm(
                      (p) => ({
                        ...p,
                        date:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>

              <Field label="Payment Mode">
                <select
                  className="form-input"
                  value={
                    expenseForm.paymentMode
                  }
                  onChange={(e) =>
                    setExpenseForm(
                      (p) => ({
                        ...p,
                        paymentMode:
                          e.target
                            .value,
                      })
                    )
                  }
                >
                  {paymentModes.map(
                    (x) => (
                      <option
                        key={x}
                      >
                        {x}
                      </option>
                    )
                  )}
                </select>
              </Field>
            </div>

            <Field
              label={
                <>
                  Note{" "}
                  <span>
                    Optional
                  </span>
                </>
              }
            >
              <input
                className="form-input"
                value={
                  expenseForm.note
                }
                onChange={(e) =>
                  setExpenseForm(
                    (p) => ({
                      ...p,
                      note:
                        e.target
                          .value,
                    })
                  )
                }
                placeholder="e.g. Dinner with family"
              />
            </Field>

            <Actions
              close={closeModal}
              save={
                saving
                  ? "Saving..."
                  : editing
                  ? "Update Expense"
                  : "Save Expense"
              }
            />
          </form>
        </Modal>
      )}

      {/* ================= INCOME MODAL ================= */}

      {modal === "income" && (
        <Modal
          title={
            editing
              ? "Edit Income"
              : "Add Income"
          }
          eyebrow="INCOME"
          subtitle="Record money received"
          onClose={closeModal}
        >
          <form
            onSubmit={saveIncome}
          >
            <AmountInput
              value={
                incomeForm.amount
              }
              onChange={(v) =>
                setIncomeForm(
                  (p) => ({
                    ...p,
                    amount: v,
                  })
                )
              }
            />

            <Field label="Income Source">
              <div className="category-grid">
                {incomeSources.map(
                  (c) => (
                    <button
                      type="button"
                      key={c}
                      className={`category-option ${
                        incomeForm.source ===
                        c
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setIncomeForm(
                          (p) => ({
                            ...p,
                            source:
                              c,
                          })
                        )
                      }
                    >
                      {c}
                    </button>
                  )
                )}
              </div>
            </Field>

            <div className="form-row">
              <Field label="Date">
                <input
                  className="form-input"
                  type="date"
                  value={
                    incomeForm.date
                  }
                  onChange={(e) =>
                    setIncomeForm(
                      (p) => ({
                        ...p,
                        date:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>

              <Field label="Received Via">
                <select
                  className="form-input"
                  value={
                    incomeForm.paymentMode
                  }
                  onChange={(e) =>
                    setIncomeForm(
                      (p) => ({
                        ...p,
                        paymentMode:
                          e.target
                            .value,
                      })
                    )
                  }
                >
                  {paymentModes.map(
                    (x) => (
                      <option
                        key={x}
                      >
                        {x}
                      </option>
                    )
                  )}
                </select>
              </Field>
            </div>

            <Field
              label={
                <>
                  Note{" "}
                  <span>
                    Optional
                  </span>
                </>
              }
            >
              <input
                className="form-input"
                value={
                  incomeForm.note
                }
                onChange={(e) =>
                  setIncomeForm(
                    (p) => ({
                      ...p,
                      note:
                        e.target
                          .value,
                    })
                  )
                }
                placeholder="e.g. August salary"
              />
            </Field>

            <Actions
              close={closeModal}
              save={
                saving
                  ? "Saving..."
                  : editing
                  ? "Update Income"
                  : "Save Income"
              }
            />
          </form>
        </Modal>
      )}

      {/* ================= LOAN MODAL ================= */}

      {modal === "loan" && (
        <Modal
          title={
            editing
              ? "Edit Loan"
              : "Add Loan"
          }
          eyebrow="LOAN MANAGEMENT"
          subtitle="Track your loan and EMI details"
          onClose={closeModal}
        >
          <form
            onSubmit={saveLoan}
          >
            <Field label="Loan Type">
              <select
                className="form-input"
                value={
                  loanForm.loanType
                }
                onChange={(e) =>
                  setLoanForm(
                    (p) => ({
                      ...p,
                      loanType:
                        e.target
                          .value,
                    })
                  )
                }
              >
                {loanTypes.map(
                  (x) => (
                    <option
                      key={x}
                    >
                      {x}
                    </option>
                  )
                )}
              </select>
            </Field>

            <div className="form-row">
              <Field label="Loan Name">
                <input
                  className="form-input"
                  required
                  value={
                    loanForm.loanName
                  }
                  onChange={(e) =>
                    setLoanForm(
                      (p) => ({
                        ...p,
                        loanName:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="e.g. Home Loan"
                />
              </Field>

              <Field label="Bank / Lender">
                <input
                  className="form-input"
                  value={
                    loanForm.lender
                  }
                  onChange={(e) =>
                    setLoanForm(
                      (p) => ({
                        ...p,
                        lender:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="e.g. HDFC Bank"
                />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Original Loan Amount">
                <input
                  className="form-input"
                  type="number"
                  required
                  value={
                    loanForm.amount
                  }
                  onChange={(e) =>
                    setLoanForm(
                      (p) => ({
                        ...p,
                        amount:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>

              <Field label="Outstanding Principal">
                <input
                  className="form-input"
                  type="number"
                  value={
                    loanForm.outstanding
                  }
                  onChange={(e) =>
                    setLoanForm(
                      (p) => ({
                        ...p,
                        outstanding:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Interest Rate %">
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={
                    loanForm.interestRate
                  }
                  onChange={(e) =>
                    setLoanForm(
                      (p) => ({
                        ...p,
                        interestRate:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>

              <Field label="Monthly EMI">
                <input
                  className="form-input"
                  type="number"
                  required
                  value={
                    loanForm.emi
                  }
                  onChange={(e) =>
                    setLoanForm(
                      (p) => ({
                        ...p,
                        emi:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Remaining Tenure (months)">
                <input
                  className="form-input"
                  type="number"
                  value={
                    loanForm.tenure
                  }
                  onChange={(e) =>
                    setLoanForm(
                      (p) => ({
                        ...p,
                        tenure:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>

              <Field label="Next EMI Date">
                <input
                  className="form-input"
                  type="date"
                  value={
                    loanForm.nextEmiDate
                  }
                  onChange={(e) =>
                    setLoanForm(
                      (p) => ({
                        ...p,
                        nextEmiDate:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>
            </div>

            <Field
              label={
                <>
                  Note{" "}
                  <span>
                    Optional
                  </span>
                </>
              }
            >
              <input
                className="form-input"
                value={
                  loanForm.note
                }
                onChange={(e) =>
                  setLoanForm(
                    (p) => ({
                      ...p,
                      note:
                        e.target
                          .value,
                    })
                  )
                }
              />
            </Field>

            <Actions
              close={closeModal}
              save={
                saving
                  ? "Saving..."
                  : editing
                  ? "Update Loan"
                  : "Save Loan"
              }
            />
          </form>
        </Modal>
      )}

      {/* ================= PREPAYMENT MODAL ================= */}

      {modal === "prepayment" &&
        selectedLoan && (
          <Modal
            title="Prepayment Calculator"
            eyebrow="🧮 HOME LOAN PLANNER"
            subtitle={`See how much you can save • ${selectedLoan.loanName}`}
            onClose={closeModal}
          >
            <Field label="Outstanding Principal">
              <input
                className="form-input"
                type="number"
                value={
                  prepayForm.outstanding
                }
                onChange={(e) =>
                  setPrepayForm(
                    (p) => ({
                      ...p,
                      outstanding:
                        e.target
                          .value,
                    })
                  )
                }
              />
            </Field>

            <div className="form-row">
              <Field label="Interest Rate %">
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={
                    prepayForm.interestRate
                  }
                  onChange={(e) =>
                    setPrepayForm(
                      (p) => ({
                        ...p,
                        interestRate:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>

              <Field label="Current EMI">
                <input
                  className="form-input"
                  type="number"
                  value={
                    prepayForm.emi
                  }
                  onChange={(e) =>
                    setPrepayForm(
                      (p) => ({
                        ...p,
                        emi:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>
            </div>

            <div className="form-row">
              <Field label="Remaining Tenure">
                <input
                  className="form-input"
                  type="number"
                  value={
                    prepayForm.remainingTenure
                  }
                  onChange={(e) =>
                    setPrepayForm(
                      (p) => ({
                        ...p,
                        remainingTenure:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>

              <Field label="Prepayment Amount">
                <input
                  className="form-input"
                  type="number"
                  value={
                    prepayForm.prepayment
                  }
                  onChange={(e) =>
                    setPrepayForm(
                      (p) => ({
                        ...p,
                        prepayment:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </Field>
            </div>

            <Field label="Strategy">
              <div className="category-grid">
                <button
                  type="button"
                  className={`category-option ${
                    prepayForm.option ===
                    "tenure"
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setPrepayForm(
                      (p) => ({
                        ...p,
                        option:
                          "tenure",
                      })
                    )
                  }
                >
                  ⏳ Reduce Tenure
                </button>

                <button
                  type="button"
                  className={`category-option ${
                    prepayForm.option ===
                    "emi"
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setPrepayForm(
                      (p) => ({
                        ...p,
                        option:
                          "emi",
                      })
                    )
                  }
                >
                  💰 Reduce EMI
                </button>
              </div>
            </Field>

            {prepayResult && (
              <div className="calculator-result">
                <div className="result-grid">
                  <Stat
                    label="Interest Saved"
                    value={money(
                      prepayResult.interestSaved
                    )}
                    note="Estimated saving"
                  />

                  <Stat
                    label="Tenure Saved"
                    value={`${prepayResult.tenureSaved} months`}
                    note="Earlier closure"
                  />

                  <Stat
                    label="New Principal"
                    value={money(
                      prepayResult.principal
                    )}
                    note="After prepayment"
                  />

                  <Stat
                    label="New Tenure"
                    value={`${prepayResult.newTenure} months`}
                    note="At same EMI"
                  />
                </div>

                {prepayForm.option ===
                  "emi" && (
                  <div className="new-emi">
                    <small>
                      Estimated New EMI
                    </small>

                    <strong>
                      {money(
                        prepayResult.newEmi
                      )}
                    </strong>

                    <span>
                      Saving{" "}
                      {money(
                        prepayResult.emiSaving
                      )}{" "}
                      / month
                    </span>
                  </div>
                )}
              </div>
            )}

{prepayForm.actualPrepayment !== undefined && (
  <div
    style={{
      marginTop: "16px",
      padding: "14px",
      borderRadius: "12px",
      background: "#f6f8fb",
      border: "1px solid #e5e7eb",
    }}
  >
    <strong>
      💰 Actual Bank Prepayment
    </strong>

    <div style={{ marginTop: "12px" }}>
      <Field label="Prepayment Amount">
        <input
          className="form-input"
          type="number"
          min="0"
          value={
            prepayForm.actualPrepayment
          }
          onChange={(e) =>
            setPrepayForm((p) => ({
              ...p,
              actualPrepayment:
                e.target.value,
            }))
          }
          placeholder="Amount paid to bank"
        />
      </Field>
    </div>

    <div style={{ marginTop: "10px" }}>
      <Field label="Payment Date">
        <input
          className="form-input"
          type="date"
          value={
            prepayForm.prepaymentDate ||
            getToday()
          }
          onChange={(e) =>
            setPrepayForm((p) => ({
              ...p,
              prepaymentDate:
                e.target.value,
            }))
          }
        />
      </Field>
    </div>

    <div style={{ marginTop: "10px" }}>
      <Field label="Note">
        <input
          className="form-input"
          type="text"
          value={
            prepayForm.prepaymentNote ||
            ""
          }
          onChange={(e) =>
            setPrepayForm((p) => ({
              ...p,
              prepaymentNote:
                e.target.value,
            }))
          }
          placeholder="Optional note"
        />
      </Field>
    </div>
  </div>
)}
<div
  style={{
    marginTop: "16px",
    display: "flex",
    justifyContent: "center",
  }}
  
>
  <button
  type="button"
  className="primary-button"
  onClick={() => {
    setPrepayForm((p) => ({
      ...p,
      actualPrepayment:
        p.prepayment || "",
      prepaymentDate: getToday(),
      prepaymentNote: "",
    }));
  }}
  >
    💰 Record Actual Prepayment
  </button>
</div>
            <Actions
              close={closeModal}
              save="Close"
              onlyClose
            />
          </Modal>
        )}<div
  style={{
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
  }}
>
  <button
    type="button"
    className="btn secondary"
    onClick={closeModal}
  >
    Close
  </button>

  <button
    type="button"
    className="btn primary"
    onClick={applyPrepayment}
    disabled={!prepayResult || saving}
  >
    {saving
      ? "Applying..."
      : "Apply Prepayment"}
  </button>
</div>
    </div>
  );
}


/* =========================
   COMPONENTS
========================= */

function PageHead({
  eyebrow,
  title,
  text,
  action,
  onAction,
}) {
  return (
    <section className="page-head">
      <div>
        <span className="eyebrow">
          {eyebrow}
        </span>

        <h2>{title}</h2>

        <p>{text}</p>
      </div>

      {action && (
        <button
          className="primary-btn"
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  note,
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>

      <strong>{value}</strong>

      <small>{note}</small>
    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div className="field">
      <label>{label}</label>

      {children}
    </div>
  );
}

function AmountInput({
  value,
  onChange,
}) {
  return (
    <div className="field">
      <label>Amount</label>

      <div className="amount-input">
        <span>₹</span>

        <input
          autoFocus
          type="number"
          min="0"
          step="0.01"
          required
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value
            )
          }
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

function Actions({
  close,
  save,
  onlyClose = false,
}) {
  return (
    <div className="modal-actions">
      {!onlyClose && (
        <button
          type="button"
          className="secondary-btn"
          onClick={close}
        >
          Cancel
        </button>
      )}

      <button
        type={
          onlyClose
            ? "button"
            : "submit"
        }
        className="save-expense-btn"
        onClick={
          onlyClose
            ? close
            : undefined
        }
      >
        {save}
        {!onlyClose && " →"}
      </button>
    </div>
  );
}

function Modal({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
}) {
  return (
    <div className="expense-modal">
      <div
        className="modal-overlay"
        onMouseDown={onClose}
      />

      <div
        className="modal-card"
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              {eyebrow}
            </span>

            <h3>{title}</h3>

            <p>{subtitle}</p>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/* =========================================================
   MODAL VISIBILITY FIX
   Add after the LAST line of App.jsx
========================================================= */

if (typeof document !== "undefined") {
  const style = document.createElement("style");

  style.id = "mh-modal-visibility-fix";

  style.textContent = `
    .expense-modal {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 99999 !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }

    .modal-overlay {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 99998 !important;
    }

    .modal-card {
      position: relative !important;
      z-index: 99999 !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      max-height: 90vh !important;
      overflow-y: auto !important;
    }
  `;

  if (!document.getElementById("mh-modal-visibility-fix")) {
    document.head.appendChild(style);
  }
}

export default App;