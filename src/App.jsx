import { useEffect, useMemo, useState } from "react";
import "./App.css";

const categories = ["Food", "Grocery", "Bills", "Travel", "Shopping", "Medical", "Other"];
const incomeSources = ["Salary", "Business", "Freelance", "Bonus", "Interest", "Other"];
const loanTypes = ["Home Loan", "Personal Loan", "Car Loan", "Education Loan", "Gold Loan", "Other Loan"];
const paymentModes = ["Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer"];

const getToday = () => new Date().toISOString().split("T")[0];
const getMonthKey = (date) => String(date || "").slice(0, 7);
const money = (n) =>
  `₹ ${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function load(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [month, setMonth] = useState(getMonthKey(getToday()));

  const [expenses, setExpenses] = useState(() => load("mazaHishobExpenses"));
  const [incomes, setIncomes] = useState(() => load("mazaHishobIncomes"));
  const [loans, setLoans] = useState(() => load("mazaHishobLoans"));
  const [emiPayments, setEmiPayments] = useState(() => load("mazaHishobEmiPayments"));

  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterMode, setFilterMode] = useState("All");

  const [expenseForm, setExpenseForm] = useState({
    amount: "", category: "Food", date: getToday(), paymentMode: "Cash", note: "",
  });
  const [incomeForm, setIncomeForm] = useState({
    amount: "", source: "Salary", date: getToday(), paymentMode: "Bank Transfer", note: "",
  });
  const [loanForm, setLoanForm] = useState({
    loanType: "Home Loan", loanName: "", lender: "", amount: "", outstanding: "",
    interestRate: "", emi: "", tenure: "", startDate: getToday(), nextEmiDate: "", note: "",
  });
  const [prepayForm, setPrepayForm] = useState({
    outstanding: "", interestRate: "", emi: "", remainingTenure: "", prepayment: "", option: "tenure",
  });
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [backupMessage, setBackupMessage] = useState("");

  useEffect(() => localStorage.setItem("mazaHishobExpenses", JSON.stringify(expenses)), [expenses]);
  useEffect(() => localStorage.setItem("mazaHishobIncomes", JSON.stringify(incomes)), [incomes]);
  useEffect(() => localStorage.setItem("mazaHishobLoans", JSON.stringify(loans)), [loans]);
  useEffect(() => localStorage.setItem("mazaHishobEmiPayments", JSON.stringify(emiPayments)), [emiPayments]);

  const formatMoney = money;

  const monthExpenses = useMemo(
    () => expenses.filter((x) => getMonthKey(x.date) === month),
    [expenses, month]
  );
  const monthIncomes = useMemo(
    () => incomes.filter((x) => getMonthKey(x.date) === month),
    [incomes, month]
  );

  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalIncome = incomes.reduce((s, x) => s + Number(x.amount || 0), 0);
  const monthExpenseTotal = monthExpenses.reduce((s, x) => s + Number(x.amount || 0), 0);
  const monthIncomeTotal = monthIncomes.reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalBalance = totalIncome - totalExpenses;
  const monthSavings = monthIncomeTotal - monthExpenseTotal;

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((x) => {
      const matchesSearch =
        !q ||
        String(x.category).toLowerCase().includes(q) ||
        String(x.note || "").toLowerCase().includes(q);
      const matchesCategory = filterCategory === "All" || x.category === filterCategory;
      const matchesMode = filterMode === "All" || x.paymentMode === filterMode;
      return matchesSearch && matchesCategory && matchesMode;
    });
  }, [expenses, search, filterCategory, filterMode]);

  const categoryTotals = useMemo(() => {
    return categories
      .map((category) => ({
        category,
        amount: monthExpenses
          .filter((x) => x.category === category)
          .reduce((s, x) => s + Number(x.amount || 0), 0),
      }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  const openExpense = (item = null) => {
    setEditing(item);
    setExpenseForm(item
      ? { amount: item.amount, category: item.category, date: item.date, paymentMode: item.paymentMode, note: item.note || "" }
      : { amount: "", category: "Food", date: getToday(), paymentMode: "Cash", note: "" });
    setModal("expense");
  };

  const saveExpense = (e) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) return alert("Please enter a valid amount.");
    if (editing) {
      setExpenses((prev) => prev.map((x) => x.id === editing.id ? { ...x, ...expenseForm, amount: Number(expenseForm.amount) } : x));
    } else {
      setExpenses((prev) => [{ ...expenseForm, id: Date.now(), amount: Number(expenseForm.amount), createdAt: new Date().toISOString() }, ...prev]);
    }
    setModal(null); setEditing(null);
  };

  const openIncome = (item = null) => {
    setEditing(item);
    setIncomeForm(item
      ? { amount: item.amount, source: item.source, date: item.date, paymentMode: item.paymentMode, note: item.note || "" }
      : { amount: "", source: "Salary", date: getToday(), paymentMode: "Bank Transfer", note: "" });
    setModal("income");
  };

  const saveIncome = (e) => {
    e.preventDefault();
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) return alert("Please enter a valid income amount.");
    if (editing) {
      setIncomes((prev) => prev.map((x) => x.id === editing.id ? { ...x, ...incomeForm, amount: Number(incomeForm.amount) } : x));
    } else {
      setIncomes((prev) => [{ ...incomeForm, id: Date.now(), amount: Number(incomeForm.amount), createdAt: new Date().toISOString() }, ...prev]);
    }
    setModal(null); setEditing(null);
  };

  const openLoan = (loan = null) => {
    setEditing(loan);
    setLoanForm(loan
      ? {
          loanType: loan.loanType, loanName: loan.loanName, lender: loan.lender || "",
          amount: loan.amount, outstanding: loan.outstanding ?? loan.amount, interestRate: loan.interestRate,
          emi: loan.emi, tenure: loan.tenure, startDate: loan.startDate || getToday(),
          nextEmiDate: loan.nextEmiDate || "", note: loan.note || "",
        }
      : {
          loanType: "Home Loan", loanName: "", lender: "", amount: "", outstanding: "",
          interestRate: "", emi: "", tenure: "", startDate: getToday(), nextEmiDate: "", note: "",
        });
    setModal("loan");
  };

  const saveLoan = (e) => {
    e.preventDefault();
    if (!loanForm.loanName.trim() || !loanForm.amount || !loanForm.emi) {
      return alert("Please enter Loan Name, Amount and EMI.");
    }
    const data = {
      ...loanForm,
      loanName: loanForm.loanName.trim(),
      lender: loanForm.lender.trim(),
      amount: Number(loanForm.amount),
      outstanding: Number(loanForm.outstanding || loanForm.amount),
      interestRate: Number(loanForm.interestRate || 0),
      emi: Number(loanForm.emi),
      tenure: Number(loanForm.tenure || 0),
      note: loanForm.note.trim(),
    };
    if (editing) {
      setLoans((prev) => prev.map((x) => x.id === editing.id ? { ...x, ...data } : x));
    } else {
      setLoans((prev) => [{ ...data, id: Date.now(), createdAt: new Date().toISOString() }, ...prev]);
    }
    setModal(null); setEditing(null);
  };

  const deleteExpense = (id) => setExpenses((p) => p.filter((x) => x.id !== id));
  const deleteIncome = (id) => setIncomes((p) => p.filter((x) => x.id !== id));
  const deleteLoan = (id) => setLoans((p) => p.filter((x) => x.id !== id));

  const addMonth = (date, months = 1) => {
    const d = new Date(`${date}T00:00:00`);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  };

  const markEmiPaid = (loan) => {
    const currentOutstanding = Number(loan.outstanding ?? loan.amount ?? 0);
    const rate = Number(loan.interestRate || 0) / 100 / 12;
    const emi = Number(loan.emi || 0);
    const interest = currentOutstanding * rate;
    const principal = Math.max(emi - interest, 0);
    const newOutstanding = Math.max(currentOutstanding - principal, 0);
    const nextDate = loan.nextEmiDate ? addMonth(loan.nextEmiDate) : "";

    setEmiPayments((p) => [{
      id: Date.now(), loanId: loan.id, loanName: loan.loanName,
      amount: emi, paidDate: getToday(), createdAt: new Date().toISOString(),
    }, ...p]);

    setLoans((p) => p.map((x) => x.id === loan.id ? {
      ...x, outstanding: newOutstanding,
      nextEmiDate: newOutstanding > 0 ? nextDate : "",
      tenure: Math.max(Number(x.tenure || 0) - 1, 0),
      status: newOutstanding <= 0 ? "Closed" : "Active",
    } : x));
  };

  const openPrepayment = (loan) => {
    setSelectedLoan(loan);
    setPrepayForm({
      outstanding: loan.outstanding ?? loan.amount ?? "",
      interestRate: loan.interestRate || "",
      emi: loan.emi || "",
      remainingTenure: loan.tenure || "",
      prepayment: "",
      option: "tenure",
    });
    setModal("prepayment");
  };

  const prepayResult = useMemo(() => {
    const P = Number(prepayForm.outstanding), rate = Number(prepayForm.interestRate) / 100 / 12;
    const emi = Number(prepayForm.emi), months = Number(prepayForm.remainingTenure), pp = Number(prepayForm.prepayment);
    if (!P || !emi || !months || !pp || pp <= 0) return null;
    const principal = Math.max(P - pp, 0);
    const oldInterest = Math.max(emi * months - P, 0);
    let newTenure = months;
    if (principal <= 0) newTenure = 0;
    else if (rate > 0 && emi > principal * rate) {
      newTenure = Math.ceil(-Math.log(1 - (principal * rate) / emi) / Math.log(1 + rate));
    } else if (rate === 0) {
      newTenure = Math.ceil(principal / emi);
    }
    const newInterest = Math.max(emi * newTenure - principal, 0);
    const interestSaved = Math.max(oldInterest - newInterest, 0);
    let newEmi = emi;
    if (principal <= 0) newEmi = 0;
    else if (rate > 0) newEmi = (principal * rate) / (1 - Math.pow(1 + rate, -months));
    else newEmi = principal / months;
    return {
      principal, newTenure, interestSaved,
      tenureSaved: Math.max(months - newTenure, 0),
      newEmi, emiSaving: Math.max(emi - newEmi, 0),
    };
  }, [prepayForm]);

  const transactions = useMemo(() => [
    ...expenses.map((x) => ({ ...x, type: "expense", title: x.category })),
    ...incomes.map((x) => ({ ...x, type: "income", title: x.source })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8), [expenses, incomes]);

  const upcomingLoan = useMemo(() => {
    const active = loans.filter((x) => Number(x.outstanding ?? x.amount) > 0);
    return [...active].sort((a, b) => {
      if (!a.nextEmiDate) return 1;
      if (!b.nextEmiDate) return -1;
      return new Date(a.nextEmiDate) - new Date(b.nextEmiDate);
    })[0] || null;
  }, [loans]);

  const exportData = () => {
    const data = { expenses, incomes, loans, emiPayments, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `maza-hishob-backup-${getToday()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setBackupMessage("Backup downloaded successfully.");
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!Array.isArray(d.expenses) || !Array.isArray(d.incomes) || !Array.isArray(d.loans)) throw new Error();
        setExpenses(d.expenses); setIncomes(d.incomes); setLoans(d.loans); setEmiPayments(d.emiPayments || []);
        setBackupMessage("Backup restored successfully.");
      } catch { setBackupMessage("Invalid backup file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resetAll = () => {
    if (!window.confirm("This will permanently delete all Finance Guru data. Continue?")) return;
    setExpenses([]); setIncomes([]); setLoans([]); setEmiPayments([]);
    setBackupMessage("All data cleared.");
  };

  const nav = [
    ["home", "⌂", "Home"],
    ["expenses", "◈", "Daily Expenses"],
    ["loans", "▣", "Loans"],
    ["reports", "◫", "Reports"],
  ];

  const pageTitle = {
    home: "Dashboard", expenses: "Daily Expenses", loans: "Loans", reports: "Reports", settings: "Settings"
  }[activePage];

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="brand">
          <div className="brand-logo">MH</div>
          <div className="brand-text">
            <h1>Maza Hishob</h1>
            <p>Money Tracker & Personal Finance Manager</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" title="Reports" onClick={() => setActivePage("reports")}>◫</button>
          <button className="profile-btn" title="Settings" onClick={() => setActivePage("settings")}>⚙</button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-section">
            <span className="sidebar-label">MAIN MENU</span>
            {nav.map(([key, icon, label]) => (
              <button key={key} className={`side-item ${activePage === key ? "active" : ""}`} onClick={() => setActivePage(key)}>
                <span className="side-icon">{icon}</span><span>{label}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button className={`side-item ${activePage === "settings" ? "active" : ""}`} onClick={() => setActivePage("settings")}>
              <span className="side-icon">⚙</span><span>Settings</span>
            </button>
            <button className="side-item" onClick={() => alert("Maza Hishob\nYour data is stored locally in this browser.")}>
              <span className="side-icon">?</span><span>Help & Support</span>
            </button>
          </div>
        </aside>

        <main className="main-content">
          {activePage === "home" && (
            <>
              <section className="welcome-section">
                <div><span className="eyebrow">DASHBOARD</span><h2>Good morning 👋</h2><p>Here's your financial overview</p></div>
                <div className="month-picker"><span>Overview</span><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
              </section>

              <section className="balance-card">
                <div className="balance-glow glow-one"></div><div className="balance-glow glow-two"></div>
                <div className="balance-header">
                  <div><span className="balance-label">TOTAL BALANCE</span><h3>{formatMoney(totalBalance)}</h3></div>
                  <div className="balance-status"><span className="status-dot"></span>{monthLabel}</div>
                </div>
                <div className="balance-divider"></div>
                <div className="balance-summary">
                  <div className="balance-stat"><div className="stat-icon income">↗</div><div><span>Income</span><strong>{formatMoney(monthIncomeTotal)}</strong></div></div>
                  <div className="balance-stat"><div className="stat-icon expense">↘</div><div><span>Expenses</span><strong>{formatMoney(monthExpenseTotal)}</strong></div></div>
                  <div className="balance-stat"><div className="stat-icon saving">◇</div><div><span>Savings</span><strong>{formatMoney(monthSavings)}</strong></div></div>
                </div>
              </section>

              <section className="dashboard-section">
                <div className="section-heading"><div><span>GET STARTED</span><h3>Quick Actions</h3></div></div>
                <div className="quick-actions">
                  <button className="action-card expense-action" onClick={() => openExpense()}><div className="action-icon">↘</div><div className="action-content"><strong>Add Expense</strong><span>Track daily spending</span></div><span className="card-arrow">→</span></button>
                  <button className="action-card income-action" onClick={() => openIncome()}><div className="action-icon">↗</div><div className="action-content"><strong>Add Income</strong><span>Record your income</span></div><span className="card-arrow">→</span></button>
                  <button className="action-card loan-action" onClick={() => openLoan()}><div className="action-icon">＋</div><div className="action-content"><strong>Add Loan</strong><span>Track your loans</span></div><span className="card-arrow">→</span></button>
                </div>
              </section>

              <section className="dashboard-section">
                <div className="section-heading"><div><span>YOUR FINANCES</span><h3>Finance Snapshot</h3></div></div>
                <div className="finance-grid">
                  <button className="finance-card" onClick={() => setActivePage("expenses")}><div className="finance-card-top"><div className="finance-icon expenses-icon">◈</div><span className="card-arrow">→</span></div><div className="finance-info"><span>Daily Expenses</span><strong>{formatMoney(totalExpenses)}</strong><small>Total tracked</small></div></button>
                  <button className="finance-card" onClick={() => setActivePage("loans")}><div className="finance-card-top"><div className="finance-icon loans-icon">▣</div><span className="card-arrow">→</span></div><div className="finance-info"><span>Loans</span><strong>{loans.filter(x => (x.status || "Active") !== "Closed").length}</strong><small>Active Loans</small></div></button>
                </div>
              </section>

              <section className="dashboard-section">
                <div className="section-heading"><div><span>LOAN TRACKING</span><h3>Upcoming EMI</h3></div><button className="view-link" onClick={() => setActivePage("loans")}>View Loans →</button></div>
                {upcomingLoan ? (
                  <div className="emi-card">
                    <div className="emi-icon">◷</div><div className="emi-content"><strong>{upcomingLoan.loanName}</strong><span>EMI {formatMoney(upcomingLoan.emi)} {upcomingLoan.nextEmiDate ? `• Due ${upcomingLoan.nextEmiDate}` : ""}</span></div>
                    <button className="paid-btn" onClick={() => markEmiPaid(upcomingLoan)}>✓ Paid</button>
                  </div>
                ) : (
                  <button className="emi-card" onClick={() => openLoan()}><div className="emi-icon">◷</div><div className="emi-content"><strong>No upcoming EMI</strong><span>Add a loan to start tracking your EMI payments</span></div><span className="card-arrow">→</span></button>
                )}
              </section>

              <section className="dashboard-section recent-section">
                <div className="section-heading"><div><span>ACTIVITY</span><h3>Recent Transactions</h3></div><button className="view-link" onClick={() => setActivePage("expenses")}>View All →</button></div>
                {transactions.length ? <div className="transaction-list">{transactions.map((t) => (
                  <div className="transaction-item" key={`${t.type}-${t.id}`}>
                    <div className={`transaction-icon ${t.type === "income" ? "income-transaction" : ""}`}>{t.type === "income" ? "↗" : "↘"}</div>
                    <div className="transaction-details"><strong>{t.title}</strong><span>{t.note || t.paymentMode}</span></div>
                    <div className="transaction-right"><strong>{t.type === "income" ? "+" : "-"} {formatMoney(t.amount)}</strong><span>{t.date}</span></div>
                  </div>
                ))}</div> : <div className="empty-transactions"><div className="empty-icon">◇</div><h4>No transactions yet</h4><p>Your recent income and expenses will appear here.</p><button className="primary-btn" onClick={() => openExpense()}>＋ Add Expense</button></div>}
              </section>
            </>
          )}

          {activePage === "expenses" && (
            <>
              <PageHead eyebrow="EXPENSE MANAGEMENT" title="Daily Expenses" text="Track and manage every expense" action="＋ Add Expense" onAction={() => openExpense()} />
              <div className="stats-row"><Stat label="All Expenses" value={formatMoney(totalExpenses)} note={`${expenses.length} transactions`} /><Stat label={`${monthLabel} Expenses`} value={formatMoney(monthExpenseTotal)} note={`${monthExpenses.length} transactions`} /><Stat label="Average Expense" value={formatMoney(expenses.length ? totalExpenses / expenses.length : 0)} note="Per transaction" /></div>
              <div className="filter-bar">
                <input className="form-input" placeholder="🔎 Search category or note..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="form-input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}><option>All</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
                <select className="form-input" value={filterMode} onChange={(e) => setFilterMode(e.target.value)}><option>All</option>{paymentModes.map(m => <option key={m}>{m}</option>)}</select>
              </div>
              <div className="transaction-list">{filteredExpenses.length ? filteredExpenses.map(x => (
                <div className="transaction-item" key={x.id}><div className="transaction-icon">↘</div><div className="transaction-details"><strong>{x.category}</strong><span>{x.note || x.paymentMode}</span></div><div className="transaction-right"><strong>- {formatMoney(x.amount)}</strong><span>{x.date}</span></div><button className="mini-btn" onClick={() => openExpense(x)}>✎</button><button className="delete-expense" onClick={() => deleteExpense(x.id)}>×</button></div>
              )) : <div className="empty-transactions"><div className="empty-icon">◇</div><h4>No matching expenses</h4><p>Try another filter or add a new expense.</p></div>}</div>
            </>
          )}

          {activePage === "loans" && (
            <>
              <PageHead eyebrow="LOAN MANAGEMENT" title="Loans & EMI" text="Track outstanding, EMI payments and prepayments" action="＋ Add Loan" onAction={() => openLoan()} />
              <div className="stats-row"><Stat label="Active Loans" value={String(loans.filter(x => (x.status || "Active") !== "Closed").length)} note="Currently running" /><Stat label="Monthly EMI" value={formatMoney(loans.reduce((s,x) => s + Number(x.emi || 0), 0))} note="Total EMI / month" /><Stat label="Outstanding" value={formatMoney(loans.reduce((s,x) => s + Number(x.outstanding ?? x.amount ?? 0), 0))} note="Current principal" /></div>
              <div className="loan-grid">{loans.length ? loans.map(loan => (
                <div className="loan-card" key={loan.id}>
                  <div className="loan-card-top"><div className="finance-icon loans-icon">▣</div><span className={`loan-status ${(loan.status || "Active") === "Closed" ? "closed" : ""}`}>{loan.status || "Active"}</span></div>
                  <h3>{loan.loanName}</h3><p>{loan.lender || loan.loanType}</p>
                  <div className="loan-numbers"><div><span>Outstanding</span><strong>{formatMoney(loan.outstanding ?? loan.amount)}</strong></div><div><span>EMI</span><strong>{formatMoney(loan.emi)}</strong></div><div><span>Rate</span><strong>{loan.interestRate || 0}%</strong></div></div>
                  <div className="loan-actions"><button className="primary-btn small" onClick={() => markEmiPaid(loan)}>✓ EMI Paid</button><button className="secondary-btn" onClick={() => openPrepayment(loan)}>🧮 Prepay</button><button className="secondary-btn" onClick={() => openLoan(loan)}>✎</button><button className="delete-expense" onClick={() => deleteLoan(loan.id)}>×</button></div>
                  {loan.nextEmiDate && <small className="loan-next">Next EMI: {loan.nextEmiDate}</small>}
                </div>
              )) : <div className="empty-transactions"><div className="empty-icon">▣</div><h4>No loans added</h4><p>Add your home loan or any other loan to start tracking it.</p><button className="primary-btn" onClick={() => openLoan()}>＋ Add Loan</button></div>}</div>
              <section className="dashboard-section"><div className="section-heading"><div><span>HISTORY</span><h3>EMI Payment History</h3></div></div>{emiPayments.length ? <div className="transaction-list">{emiPayments.map(p => <div className="transaction-item" key={p.id}><div className="transaction-icon">✓</div><div className="transaction-details"><strong>{p.loanName}</strong><span>EMI Paid</span></div><div className="transaction-right"><strong>{formatMoney(p.amount)}</strong><span>{p.paidDate}</span></div><button className="delete-expense" onClick={() => setEmiPayments(prev => prev.filter(x => x.id !== p.id))}>×</button></div>)}</div> : <p className="muted">No EMI payments recorded yet.</p>}</section>
            </>
          )}

          {activePage === "reports" && (
            <>
              <PageHead eyebrow="INSIGHTS" title="Reports" text="Understand where your money is going" />
              <div className="month-report-head"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><strong>{monthLabel}</strong></div>
              <div className="stats-row"><Stat label="Income" value={formatMoney(monthIncomeTotal)} note="Selected month" /><Stat label="Expenses" value={formatMoney(monthExpenseTotal)} note="Selected month" /><Stat label="Savings" value={formatMoney(monthSavings)} note="Income minus expenses" /></div>
              <section className="report-card"><div className="section-heading"><div><span>BREAKDOWN</span><h3>Expense Categories</h3></div></div>{categoryTotals.length ? categoryTotals.map(x => <div className="bar-row" key={x.category}><div><span>{x.category}</span><strong>{formatMoney(x.amount)}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min((x.amount / Math.max(categoryTotals[0].amount, 1)) * 100, 100)}%` }}></div></div></div>) : <p className="muted">No expenses for this month.</p>}</section>
              <section className="report-card"><div className="section-heading"><div><span>LOAN SUMMARY</span><h3>Debt Snapshot</h3></div></div><div className="stats-row compact"><Stat label="Loans" value={String(loans.length)} note="Total accounts" /><Stat label="Outstanding" value={formatMoney(loans.reduce((s,x) => s + Number(x.outstanding ?? x.amount ?? 0), 0))} note="Current principal" /><Stat label="EMI / Month" value={formatMoney(loans.reduce((s,x) => s + Number(x.emi || 0), 0))} note="Total monthly EMI" /></div></section>
            </>
          )}

          {activePage === "settings" && (
            <>
              <PageHead eyebrow="PREFERENCES" title="Settings" text="Manage your Finance Guru data" />
              <section className="settings-card"><div><h3>Data Backup</h3><p>Download a complete copy of your expenses, income, loans and EMI history.</p></div><button className="primary-btn" onClick={exportData}>↓ Export Backup</button></section>
              <section className="settings-card"><div><h3>Restore Backup</h3><p>Import a previously exported JSON backup.</p></div><label className="secondary-btn file-btn">↑ Import Backup<input type="file" accept=".json,application/json" onChange={importData} /></label></section>
              <section className="settings-card danger-card"><div><h3>Reset All Data</h3><p>This permanently clears all Finance Guru data from this browser.</p></div><button className="danger-btn" onClick={resetAll}>Reset Data</button></section>
              {backupMessage && <div className="success-note">{backupMessage}</div>}
            </>
          )}
        </main>
      </div>

      {modal === "expense" && <Modal title={editing ? "Edit Expense" : "Add Expense"} eyebrow="TRANSACTION" subtitle="Record your daily spending" onClose={() => setModal(null)}>
        <form onSubmit={saveExpense}><AmountInput value={expenseForm.amount} onChange={v => setExpenseForm(p => ({...p, amount:v}))} />
          <Field label="Category"><div className="category-grid">{categories.map(c => <button type="button" key={c} className={`category-option ${expenseForm.category === c ? "selected" : ""}`} onClick={() => setExpenseForm(p => ({...p, category:c}))}>{c}</button>)}</div></Field>
          <div className="form-row"><Field label="Date"><input className="form-input" type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({...p,date:e.target.value}))}/></Field><Field label="Payment Mode"><select className="form-input" value={expenseForm.paymentMode} onChange={e => setExpenseForm(p => ({...p,paymentMode:e.target.value}))}>{paymentModes.map(x=><option key={x}>{x}</option>)}</select></Field></div>
          <Field label={<>Note <span>Optional</span></>}><input className="form-input" value={expenseForm.note} onChange={e => setExpenseForm(p => ({...p,note:e.target.value}))} placeholder="e.g. Dinner with family"/></Field>
          <Actions close={() => setModal(null)} save={editing ? "Update Expense" : "Save Expense"} /></form>
      </Modal>}

      {modal === "income" && <Modal title={editing ? "Edit Income" : "Add Income"} eyebrow="INCOME" subtitle="Record money received" onClose={() => setModal(null)}>
        <form onSubmit={saveIncome}><AmountInput value={incomeForm.amount} onChange={v => setIncomeForm(p => ({...p,amount:v}))} />
          <Field label="Income Source"><div className="category-grid">{incomeSources.map(c => <button type="button" key={c} className={`category-option ${incomeForm.source === c ? "selected" : ""}`} onClick={() => setIncomeForm(p => ({...p,source:c}))}>{c}</button>)}</div></Field>
          <div className="form-row"><Field label="Date"><input className="form-input" type="date" value={incomeForm.date} onChange={e => setIncomeForm(p => ({...p,date:e.target.value}))}/></Field><Field label="Received Via"><select className="form-input" value={incomeForm.paymentMode} onChange={e => setIncomeForm(p => ({...p,paymentMode:e.target.value}))}>{paymentModes.map(x=><option key={x}>{x}</option>)}</select></Field></div>
          <Field label={<>Note <span>Optional</span></>}><input className="form-input" value={incomeForm.note} onChange={e => setIncomeForm(p => ({...p,note:e.target.value}))} placeholder="e.g. August salary"/></Field>
          <Actions close={() => setModal(null)} save={editing ? "Update Income" : "Save Income"} /></form>
      </Modal>}

      {modal === "loan" && <Modal title={editing ? "Edit Loan" : "Add Loan"} eyebrow="LOAN MANAGEMENT" subtitle="Track your loan and EMI details" onClose={() => setModal(null)}>
        <form onSubmit={saveLoan}><Field label="Loan Type"><select className="form-input" value={loanForm.loanType} onChange={e=>setLoanForm(p=>({...p,loanType:e.target.value}))}>{loanTypes.map(x=><option key={x}>{x}</option>)}</select></Field>
          <div className="form-row"><Field label="Loan Name"><input className="form-input" required value={loanForm.loanName} onChange={e=>setLoanForm(p=>({...p,loanName:e.target.value}))} placeholder="e.g. Home Loan"/></Field><Field label="Bank / Lender"><input className="form-input" value={loanForm.lender} onChange={e=>setLoanForm(p=>({...p,lender:e.target.value}))} placeholder="e.g. HDFC Bank"/></Field></div>
          <div className="form-row"><Field label="Original Loan Amount"><input className="form-input" type="number" required value={loanForm.amount} onChange={e=>setLoanForm(p=>({...p,amount:e.target.value}))}/></Field><Field label="Outstanding Principal"><input className="form-input" type="number" value={loanForm.outstanding} onChange={e=>setLoanForm(p=>({...p,outstanding:e.target.value}))} placeholder="Same as amount"/></Field></div>
          <div className="form-row"><Field label="Interest Rate %"><input className="form-input" type="number" step="0.01" value={loanForm.interestRate} onChange={e=>setLoanForm(p=>({...p,interestRate:e.target.value}))}/></Field><Field label="Monthly EMI"><input className="form-input" type="number" required value={loanForm.emi} onChange={e=>setLoanForm(p=>({...p,emi:e.target.value}))}/></Field></div>
          <div className="form-row"><Field label="Remaining Tenure (months)"><input className="form-input" type="number" value={loanForm.tenure} onChange={e=>setLoanForm(p=>({...p,tenure:e.target.value}))}/></Field><Field label="Next EMI Date"><input className="form-input" type="date" value={loanForm.nextEmiDate} onChange={e=>setLoanForm(p=>({...p,nextEmiDate:e.target.value}))}/></Field></div>
          <Field label={<>Note <span>Optional</span></>}><input className="form-input" value={loanForm.note} onChange={e=>setLoanForm(p=>({...p,note:e.target.value}))}/></Field>
          <Actions close={() => setModal(null)} save={editing ? "Update Loan" : "Save Loan"} /></form>
      </Modal>}

      {modal === "prepayment" && selectedLoan && <Modal title="Prepayment Calculator" eyebrow="🧮 HOME LOAN PLANNER" subtitle={`See how much you can save • ${selectedLoan.loanName}`} onClose={() => setModal(null)}>
        <Field label="Outstanding Principal"><input className="form-input" type="number" value={prepayForm.outstanding} onChange={e=>setPrepayForm(p=>({...p,outstanding:e.target.value}))}/></Field>
        <div className="form-row"><Field label="Interest Rate %"><input className="form-input" type="number" step="0.01" value={prepayForm.interestRate} onChange={e=>setPrepayForm(p=>({...p,interestRate:e.target.value}))}/></Field><Field label="Current EMI"><input className="form-input" type="number" value={prepayForm.emi} onChange={e=>setPrepayForm(p=>({...p,emi:e.target.value}))}/></Field></div>
        <div className="form-row"><Field label="Remaining Tenure"><input className="form-input" type="number" value={prepayForm.remainingTenure} onChange={e=>setPrepayForm(p=>({...p,remainingTenure:e.target.value}))}/></Field><Field label="Prepayment Amount"><input className="form-input" type="number" value={prepayForm.prepayment} onChange={e=>setPrepayForm(p=>({...p,prepayment:e.target.value}))}/></Field></div>
        <Field label="Strategy"><div className="category-grid"><button type="button" className={`category-option ${prepayForm.option==="tenure"?"selected":""}`} onClick={()=>setPrepayForm(p=>({...p,option:"tenure"}))}>⏳ Reduce Tenure</button><button type="button" className={`category-option ${prepayForm.option==="emi"?"selected":""}`} onClick={()=>setPrepayForm(p=>({...p,option:"emi"}))}>💰 Reduce EMI</button></div></Field>
        {prepayResult && <div className="calculator-result"><div className="result-grid"><Stat label="Interest Saved" value={formatMoney(prepayResult.interestSaved)} note="Estimated saving"/><Stat label="Tenure Saved" value={`${prepayResult.tenureSaved} months`} note="Earlier closure"/><Stat label="New Principal" value={formatMoney(prepayResult.principal)} note="After prepayment"/><Stat label="New Tenure" value={`${prepayResult.newTenure} months`} note="At same EMI"/></div>{prepayForm.option==="emi"&&<div className="new-emi"><small>Estimated New EMI</small><strong>{formatMoney(prepayResult.newEmi)}</strong><span>Saving {formatMoney(prepayResult.emiSaving)} / month</span></div>}</div>}
        <Actions close={() => setModal(null)} save="Close" onlyClose />
      </Modal>}
    </div>
  );
}

function PageHead({ eyebrow, title, text, action, onAction }) {
  return <section className="welcome-section"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>{action && <button className="primary-btn" onClick={onAction}>{action}</button>}</section>;
}
function Stat({ label, value, note }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
function Field({ label, children }) {
  return <div className="form-group"><label>{label}</label>{children}</div>;
}
function AmountInput({ value, onChange }) {
  return <div className="amount-field"><label>Amount</label><div className="amount-input"><span>₹</span><input autoFocus type="number" min="0" step="0.01" required value={value} onChange={e=>onChange(e.target.value)} placeholder="0.00"/></div></div>;
}
function Actions({ close, save, onlyClose=false }) {
  return <div className="modal-actions">{!onlyClose && <button type="button" className="cancel-btn" onClick={close}>Cancel</button>}<button type={onlyClose ? "button" : "submit"} className="save-expense-btn" onClick={onlyClose ? close : undefined}>{save} {onlyClose ? "" : "→"}</button></div>;
}
function Modal({ eyebrow, title, subtitle, onClose, children }) {
  return <div className="modal-overlay" onMouseDown={onClose}><div className="expense-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-header"><div><span className="modal-eyebrow">{eyebrow}</span><h3>{title}</h3><p>{subtitle}</p></div><button className="modal-close" onClick={onClose}>×</button></div>{children}</div></div>;
}

export default App;
