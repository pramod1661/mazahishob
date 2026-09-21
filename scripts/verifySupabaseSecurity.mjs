const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !publishableKey) {
  throw new Error("Supabase URL and publishable key are required for the security smoke test.");
}

const financialTables = [
  "expenses",
  "incomes",
  "loans",
  "emi_payments",
  "prepayment_payments",
];

for (const table of financialTables) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=id&limit=1`,
    {
      headers: {
        apikey: publishableKey,
        Prefer: "count=exact",
        Range: "0-0",
      },
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `${table}: schema/security check failed with HTTP ${response.status}.`
    );
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error(`${table}: Supabase returned an unexpected response.`);
  }
  if (rows.length > 0) {
    throw new Error(`${table}: anonymous access can read private financial rows.`);
  }

  console.log(`${table}: anonymous read is protected`);
}
