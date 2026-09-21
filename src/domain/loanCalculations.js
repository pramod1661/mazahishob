const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const addMonthsClamped = (dateValue, months = 1) => {
  const match = String(dateValue || "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error("A valid EMI due date is required.");
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const monthOffset = Number(months);
  const daysInSourceMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInSourceMonth ||
    !Number.isInteger(monthOffset)
  ) {
    throw new Error("A valid EMI due date is required.");
  }

  const targetMonthIndex = year * 12 + (month - 1) + monthOffset;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonthZeroBased =
    ((targetMonthIndex % 12) + 12) % 12;
  const targetMonth = targetMonthZeroBased + 1;
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth, 0)
  ).getUTCDate();
  const safeDay = Math.min(day, daysInTargetMonth);

  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(
    safeDay
  ).padStart(2, "0")}`;
};

export const calculateRemainingTenure = ({
  outstanding,
  monthlyRate,
  emi,
  fallbackTenure = 0,
}) => {
  const principal = Math.max(Number(outstanding || 0), 0);
  const rate = Math.max(Number(monthlyRate || 0), 0);
  const payment = Math.max(Number(emi || 0), 0);
  const fallback = Math.max(Math.ceil(Number(fallbackTenure || 0)), 0);

  if (principal <= 0) return 0;
  if (payment <= 0) return fallback;
  if (rate === 0) return Math.ceil(principal / payment);
  if (payment <= principal * rate) return fallback;

  const ratio = 1 - (principal * rate) / payment;
  if (ratio <= 0 || ratio >= 1) return fallback;

  const months = Math.ceil(-Math.log(ratio) / Math.log1p(rate));
  return Number.isFinite(months) && months > 0 ? months : fallback;
};

export const calculateEmiSettlement = ({
  outstanding,
  annualInterestRate,
  emi,
  dueDate,
  fallbackTenure = 0,
}) => {
  const currentOutstanding = roundMoney(Math.max(Number(outstanding || 0), 0));
  const payment = roundMoney(Math.max(Number(emi || 0), 0));
  const monthlyRate = Math.max(Number(annualInterestRate || 0), 0) / 100 / 12;

  if (currentOutstanding <= 0 || payment <= 0) {
    throw new Error("Outstanding amount and EMI must be greater than zero.");
  }

  const interest = roundMoney(currentOutstanding * monthlyRate);
  const principal = roundMoney(
    Math.min(Math.max(payment - interest, 0), currentOutstanding)
  );
  const actualPaymentAmount = roundMoney(
    Math.min(payment, currentOutstanding + interest)
  );
  const newOutstanding = roundMoney(
    Math.max(currentOutstanding - principal, 0)
  );
  const remainingTenure = calculateRemainingTenure({
    outstanding: newOutstanding,
    monthlyRate,
    emi: payment,
    fallbackTenure,
  });

  return {
    interest,
    principal,
    actualPaymentAmount,
    newOutstanding,
    remainingTenure,
    nextDate: newOutstanding > 0 ? addMonthsClamped(dueDate) : null,
    status: newOutstanding > 0 ? "Active" : "Closed",
  };
};
