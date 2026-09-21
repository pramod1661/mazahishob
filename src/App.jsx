import { useCallback, useEffect, useMemo, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import "./App.css";
import "./premium.css";
import { supabase } from "./lib/supabase";
import {
  addMonthsClamped,
  calculateEmiSettlement,
  calculateRemainingTenure,
} from "./domain/loanCalculations";
import {
  getExpenseCategoryIconType,
  getExpenseCategoryKey,
} from "./domain/categoryPresentation";
import {
  mapBackupToDatabaseRows,
  restoreBackupWithRollback,
  validateBackupData,
} from "./domain/backup";
import {
  normalizeEmiPayment,
  normalizeExpense,
  normalizeIncome,
  normalizeLoan,
  normalizePrepaymentPayment,
} from "./domain/normalizers";
import { exportLedgerStatementPdf } from "./utils/ledgerPdf";
import { saveLocalBackup } from "./utils/localBackup";
import mazaHishobLogo from "./assets/maza-hishob-logo.png";
import dashboardSafe from "./assets/dashboard-safe.svg";

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

const dashboardMonths = [
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
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

const NATIVE_AUTH_REDIRECT = "com.mazahishob.app://auth/callback";

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
const INACTIVITY_WARNING_MS = 30 * 1000;
const LAST_ACTIVITY_STORAGE_KEY = "mh_last_activity_at_v1";

const readLastActivityAt = () => {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const writeLastActivityAt = (value = Date.now()) => {
  try {
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(value));
  } catch {
    // The in-memory timer still protects the current app session.
  }
  return value;
};

const clearLastActivityAt = () => {
  try {
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
};

const getOAuthRedirectUrl = () =>
  Capacitor.isNativePlatform()
    ? NATIVE_AUTH_REDIRECT
    : `${window.location.origin}/`;


function DashboardIcon({ type }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (type === "expense") {
    return (
      <svg {...common}>
        <path d="M4 7.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a3 3 0 0 1 3-3h11" />
        <path d="M17 11.5h4v4h-4a2 2 0 0 1 0-4Z" />
        <circle cx="17.8" cy="13.5" r=".65" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (type === "income") {
    return (
      <svg {...common}>
        <path d="M4 7.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a3 3 0 0 1 3-3h11" />
        <path d="M17 11.5h4v4h-4a2 2 0 0 1 0-4Z" />
        <path d="M12 3v7M9.5 5.5 12 3l2.5 2.5" />
      </svg>
    );
  }

  if (type === "loan") {
    return (
      <svg {...common}>
        <path d="M4 7h16M6 7V5.5L12 3l6 2.5V7" />
        <path d="M6 18h12M7.5 9.5v6M12 9.5v6M16.5 9.5v6" />
        <path d="M4.5 18v2h15v-2" />
      </svg>
    );
  }

  if (type === "emi") {
    return (
      <svg {...common}>
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="M3.5 10h17M8 14h3" />
        <circle cx="17" cy="14" r="1.3" />
      </svg>
    );
  }

  if (type === "reports") {
    return (
      <svg {...common}>
        <path d="M5 19V11M10 19V6M15 19v-9M20 19V3" />
      </svg>
    );
  }

  if (type === "bank") {
    return (
      <svg {...common}>
        <path d="M3 9h18M5 9V7l7-4 7 4v2M5 19h14M6.5 11.5v5M12 11.5v5M17.5 11.5v5" />
      </svg>
    );
  }

  if (type === "cart") {
    return (
      <svg {...common}>
        <path d="M3 4h2l2.2 10.2h9.7L20 7H7" />
        <circle cx="9" cy="19" r="1.4" />
        <circle cx="17" cy="19" r="1.4" />
      </svg>
    );
  }

  if (type === "food") {
    return (
      <svg {...common}>
        <path d="M7 3v7M4.8 3v4.2A2.8 2.8 0 0 0 7.6 10H9V3M7 10v11" />
        <path d="M16.5 3c-2 1.7-3 4-3 7.1 0 1.6 1 2.9 2.5 3.2V21M16.5 3v10.3" />
      </svg>
    );
  }

  if (type === "fuel") {
    return (
      <svg {...common}>
        <path d="M6 3h8v18H6zM8 6h4M14 8h2l2 2v6.5a1.5 1.5 0 0 0 3 0V8l-2-2" />
      </svg>
    );
  }

  if (type === "bolt") {
    return (
      <svg {...common}>
        <path d="m13 2-7 11h6l-1 9 7-12h-6z" />
      </svg>
    );
  }

  if (type === "travel") {
    return (
      <svg {...common}>
        <path d="m3 13 8.3-2.2V4.5a1.5 1.5 0 0 1 3 0v5.3l5.7-1.5v2.8l-5.7 3.2V19l2.7 1.5V22l-4.2-.8-4.2.8v-1.5l2.7-1.5v-4.7L3 16.1Z" />
      </svg>
    );
  }

  if (type === "shopping") {
    return (
      <svg {...common}>
        <path d="M5 8h14l-1 13H6L5 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </svg>
    );
  }

  if (type === "medical") {
    return (
      <svg {...common}>
        <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />
      </svg>
    );
  }

  if (type === "other") {
    return (
      <svg {...common}>
        <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function PrivacyIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.7 12s3.4-6 9.3-6 9.3 6 9.3 6-3.4 6-9.3 6-9.3-6-9.3-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3 12s3.4-6 9-6c1.3 0 2.5.3 3.6.8M21 12s-3.4 6-9 6c-1.3 0-2.5-.3-3.6-.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function App() {
  const [activePage, setActivePage] = useState("home");
    const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [authError, setAuthError] = useState("");
  const [authSaving, setAuthSaving] = useState(false);
  const [showLegacyLogin, setShowLegacyLogin] = useState(false);
  const [month, setMonth] = useState(getMonthKey(getToday()));
  const [amountsVisible, setAmountsVisible] = useState(true);
  const [lifetimeAmountsVisible, setLifetimeAmountsVisible] = useState(true);
  const [expenseSuggestionOpen, setExpenseSuggestionOpen] = useState(false);
  const [driveAccessToken, setDriveAccessToken] = useState(() =>
    sessionStorage.getItem("mh_drive_access_token_v2") || ""
  );

  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [loans, setLoans] = useState([]);
  const [emiPayments, setEmiPayments] = useState([]);
  const [prepaymentPayments, setPrepaymentPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("All");
  const [expenseLedgerView, setExpenseLedgerView] = useState("daily");
  const [expenseLedgerDate, setExpenseLedgerDate] = useState(getToday());
  const [ledgerComposerOpen, setLedgerComposerOpen] = useState(false);
  const [ledgerEntryType, setLedgerEntryType] = useState("expense");
  const [ledgerSuggestionOpen, setLedgerSuggestionOpen] = useState(false);
  const [ledgerPeriodPicker, setLedgerPeriodPicker] = useState(null);
  const [ledgerPickerMonth, setLedgerPickerMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [ledgerPickerYear, setLedgerPickerYear] = useState(
    new Date().getFullYear()
  );
  const [ledgerQuickForm, setLedgerQuickForm] = useState({
    name: "Food",
    amount: "",
    description: "",
    paymentMode: "UPI",
  });

  const navigateTo = useCallback((page) => {
    setActivePage(page);
    if (page !== "expenses") {
      setLedgerComposerOpen(false);
      setLedgerSuggestionOpen(false);
      setLedgerPeriodPicker(null);
    }
  }, []);

  useEffect(() => {
    if (!ledgerPeriodPicker) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setLedgerPeriodPicker(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [ledgerPeriodPicker]);

  // Common period filter used consistently across Home, Expenses, Income and Reports.
  const [periodType, setPeriodType] = useState("monthly");
  const [filterYear, setFilterYear] = useState(
    String(new Date().getFullYear())
  );
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [selectedLoan, setSelectedLoan] = useState(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [localBackupBusy, setLocalBackupBusy] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveBackups, setDriveBackups] = useState([]);
  const [selectedDriveBackupId, setSelectedDriveBackupId] = useState("");

  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(30);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  /* =========================
     LIVE USER PRESENCE
     Control Center reads this Supabase Realtime channel.
     No finance data is sent.
  ========================= */
  useEffect(() => {
    if (!session?.user?.id) return undefined;

    const user = session.user;
    const metadata = user.user_metadata || {};

    console.log("PRESENCE START - USER:", user.id);

    const presenceChannel = supabase.channel(
      "maza-hishob-online",
      {
        config: {
          presence: {
            key: user.id,
          },
        },
      }
    );

    presenceChannel.subscribe(async (status, error) => {
      console.log("PRESENCE STATUS:", status);

      if (error) {
        console.error("PRESENCE CHANNEL ERROR:", error);
      }

      if (status !== "SUBSCRIBED") return;

      try {
        const trackStatus = await presenceChannel.track({
          user_id: user.id,
          email: user.email || "",
          username:
            metadata.full_name ||
            metadata.name ||
            metadata.username ||
            user.email?.split("@")[0] ||
            "User",
          online_at: new Date().toISOString(),
          platform: Capacitor.isNativePlatform()
            ? "Android"
            : "Web",
        });

        console.log("PRESENCE TRACK RESULT:", trackStatus);
      } catch (error) {
        console.error("PRESENCE TRACK ERROR:", error);
      }
    });

    return () => {
      console.log("PRESENCE STOP - USER:", user.id);
      presenceChannel.untrack().catch(() => {});
      supabase.removeChannel(presenceChannel);
    };
  }, [session?.user]);


  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    category: "Food",
    date: getToday(),
    paymentMode: "UPI",
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

  /* =========================
     SECTION 1
     LOAN HISTORY
     ========================= */

  loanName: "",

  lender: "",

  amount: "",

  principalPaidTillDate: "",

  interestPaidTillDate: "",

  originalLoanStartDate: "",


  /* =========================
     SECTION 2
     CURRENT LOAN STATUS
     ========================= */

  outstanding: "",

  interestRate: "",

  tenure: "",

  emi: "",

  nextEmiDate: "",

  trackingDate: getToday(),


  /* =========================
     SECTION 3
     ADDITIONAL INFORMATION
     ========================= */

  loanType: "Home Loan",

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
     CAPACITOR OAUTH CALLBACK
  ========================= */

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }

    let listenerHandle;
    let cancelled = false;

    const completeNativeOAuth = async (url) => {
      if (!url || !url.startsWith(NATIVE_AUTH_REDIRECT)) {
        return;
      }

      try {
        try {
          await Browser.close();
        } catch (browserCloseError) {
          console.warn("OAuth browser close skipped:", browserCloseError);
        }

        const callbackUrl = new URL(url);
        const queryParams = callbackUrl.searchParams;
        const hashParams = new URLSearchParams(
          callbackUrl.hash.replace(/^#/, "")
        );

        const oauthError =
          queryParams.get("error_description") ||
          queryParams.get("error") ||
          hashParams.get("error_description") ||
          hashParams.get("error");

        if (oauthError) throw new Error(oauthError);

        const code = queryParams.get("code");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        // Supabase implicit OAuth returns Google provider tokens
        // directly in the callback URL fragment. These tokens are
        // intentionally not persisted by Supabase, so capture them now.
        const callbackProviderToken =
          hashParams.get("provider_token") ||
          queryParams.get("provider_token") ||
          "";

        const callbackProviderRefreshToken =
          hashParams.get("provider_refresh_token") ||
          queryParams.get("provider_refresh_token") ||
          "";

        let oauthSession = null;

        if (code) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;
          oauthSession = data?.session || null;
        } else if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;
          oauthSession = data?.session || null;
        } else {
          throw new Error(
            "Google login callback did not contain authentication details."
          );
        }

        const pendingDriveConnect =
          sessionStorage.getItem("mh_drive_connect_pending_v2") === "1";

        const providerToken =
          callbackProviderToken ||
          oauthSession?.provider_token ||
          "";

        if (callbackProviderRefreshToken) {
          sessionStorage.setItem(
            "mh_drive_refresh_token_v2",
            callbackProviderRefreshToken
          );
        }

        if (pendingDriveConnect && providerToken) {
          sessionStorage.setItem(
            "mh_drive_access_token_v2",
            providerToken
          );
          sessionStorage.setItem(
            "mh_drive_connected_v2",
            "1"
          );
          sessionStorage.removeItem(
            "mh_drive_connect_pending_v2"
          );

          setDriveAccessToken(providerToken);
          setDriveConnected(true);
          setBackupMessage(
            "Google Drive connected successfully."
          );
        }

        if (!cancelled) {
          setAuthError("");
          setAuthSaving(false);
          setDriveBusy(false);
        }
      } catch (error) {
        console.error("Native OAuth callback error:", error);
        if (!cancelled) {
          sessionStorage.removeItem("mh_drive_connect_pending_v2");
          setAuthError(error?.message || "Unable to complete Google login.");
          setBackupMessage(
            error?.message || "Unable to complete Google authentication."
          );
          setAuthSaving(false);
          setDriveBusy(false);
        }
      }
    };

    const setupDeepLinkListener = async () => {
      listenerHandle = await CapacitorApp.addListener(
        "appUrlOpen",
        ({ url }) => completeNativeOAuth(url)
      );

      const launch = await CapacitorApp.getLaunchUrl();
      if (launch?.url) {
        await completeNativeOAuth(launch.url);
      }
    };

    setupDeepLinkListener().catch((error) => {
      console.error("Unable to initialise app deep link listener:", error);
    });

    return () => {
      cancelled = true;
      listenerHandle?.remove();
    };
  }, []);

  /* =========================
   LOAD DATA FROM SUPABASE
========================= */

useEffect(() => {
  let mounted = true;

  // Clear legacy Drive flags from older builds so Drive never appears
  // connected until the user explicitly connects it in this version.
  sessionStorage.removeItem("mh_drive_connected");
  sessionStorage.removeItem("mh_drive_connect_pending");

  const syncDriveConnectionState = (nextSession) => {
    const pending =
      sessionStorage.getItem("mh_drive_connect_pending_v2") === "1";

    const explicitlyConnected =
      sessionStorage.getItem("mh_drive_connected_v2") === "1";

    const storedDriveToken =
      sessionStorage.getItem("mh_drive_access_token_v2") || "";

    const currentDriveToken =
      nextSession?.provider_token || storedDriveToken;

    const hasDriveToken = Boolean(currentDriveToken);

    if (currentDriveToken) {
      setDriveAccessToken((current) => current || currentDriveToken);
    }

    /*
     * Google Drive is NEVER auto-connected just because the user
     * signed in with Google. It becomes connected only after the
     * user explicitly presses Connect Google Drive.
     *
     * Once connected, we keep that choice only for the current
     * browser session. Disconnect / Sign Out clears it.
     */
    if (pending && hasDriveToken) {
      sessionStorage.setItem("mh_drive_connected_v2", "1");
      sessionStorage.removeItem("mh_drive_connect_pending_v2");
      setDriveConnected(true);
      setBackupMessage("Google Drive connected by you for this session.");
      return;
    }

    if (explicitlyConnected && hasDriveToken) {
      setDriveConnected(true);
      return;
    }

    if (!hasDriveToken) {
      sessionStorage.removeItem("mh_drive_connected_v2");
      sessionStorage.removeItem("mh_drive_access_token_v2");
      setDriveAccessToken("");
    }

    setDriveConnected(false);
  };

  const initAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (mounted) {
      setSession(session);
      syncDriveConnectionState(session);
      setAuthLoading(false);
    }
  };

  initAuth();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (_event, nextSession) => {
      console.log("AUTH EVENT:", _event);
      console.log("AUTH SESSION:", nextSession);

      // Initialise only a genuinely new login. A repeated SIGNED_IN event on
      // tab focus must not reset an already-running inactivity deadline.
      if (_event === "SIGNED_IN" && nextSession && !readLastActivityAt()) {
        writeLastActivityAt();
      } else if (_event === "SIGNED_OUT") {
        clearLastActivityAt();
      }

      if (mounted) {
        setSession(nextSession);
        syncDriveConnectionState(nextSession);
        setAuthLoading(false);
      }
    }
  );

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);


/* =========================
   GOOGLE LOGIN + OPTIONAL DRIVE ACCESS
========================= */

const GOOGLE_DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";

const handleGoogleLogin = async () => {
  setAuthError("");
  setAuthSaving(true);
  setDriveConnected(false);
  sessionStorage.removeItem("mh_drive_connect_pending_v2");
  sessionStorage.removeItem("mh_drive_connected_v2");

  try {
    const redirectTo = getOAuthRedirectUrl();

    const isNative = Capacitor.isNativePlatform();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: isNative,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) throw error;

    if (isNative) {
      if (!data?.url) {
        throw new Error("Unable to open Google sign-in.");
      }

      await Browser.open({
        url: data.url,
        presentationStyle: "popover",
      });
    }
  } catch (error) {
    console.error("Google login error:", error);
    setAuthError(
      error?.message ||
        "Unable to continue with Google. Please try again."
    );
    setAuthSaving(false);
  }
};

const connectGoogleDrive = async () => {
  setBackupMessage("");
  setDriveBusy(true);

  try {
    if (!isGoogleAccount) {
      throw new Error(
        "Google Drive backup is available after signing in with Google."
      );
    }

    sessionStorage.setItem("mh_drive_connect_pending_v2", "1");
    sessionStorage.removeItem("mh_drive_access_token_v2");
    sessionStorage.removeItem("mh_drive_refresh_token_v2");
    setDriveAccessToken("");

    const redirectTo = getOAuthRedirectUrl();

    const isNative = Capacitor.isNativePlatform();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: isNative,
        scopes: GOOGLE_DRIVE_SCOPE,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });

    if (error) throw error;

    if (isNative) {
      if (!data?.url) {
        throw new Error("Unable to open Google Drive authorization.");
      }

      await Browser.open({
        url: data.url,
        presentationStyle: "popover",
      });
    }
  } catch (error) {
    sessionStorage.removeItem("mh_drive_connect_pending_v2");
    console.error("Google Drive connect error:", error);
    setBackupMessage(
      `Unable to connect Google Drive. ${
        error?.message || error
      }`
    );
    setDriveBusy(false);
  }
};

const disconnectGoogleDrive = () => {
  setDriveConnected(false);
  setDriveBackups([]);
  setSelectedDriveBackupId("");
  sessionStorage.removeItem("mh_drive_connect_pending_v2");
  sessionStorage.removeItem("mh_drive_connected_v2");
  sessionStorage.removeItem("mh_drive_access_token_v2");
  sessionStorage.removeItem("mh_drive_refresh_token_v2");
  setDriveAccessToken("");
  setBackupMessage(
    "Google Drive disconnected from Maza Hishob for this session. Local backup remains available."
  );
};


/* =========================
   OPTIONAL PROFILE PHOTO
   Stored in Supabase Storage.
   Google profile photo is never imported automatically.
========================= */

const PROFILE_PHOTO_BUCKET = "profile-photos";
const PROFILE_PHOTO_NAME = "avatar.webp";

const getProfileDisplayName = () => {
  const metadata = session?.user?.user_metadata || {};
  const email = String(session?.user?.email || "");

  return (
    metadata.full_name ||
    metadata.name ||
    email.split("@")[0] ||
    "My Account"
  );
};

const isGoogleAccount = Boolean(
  session?.user?.app_metadata?.provider === "google" ||
    session?.user?.app_metadata?.providers?.includes?.("google")
);

const loadProfilePhoto = useCallback(async () => {
  if (!session?.user?.id) {
    setProfilePhotoUrl("");
    return;
  }

  try {
    const userId = session.user.id;

    const { data: files, error: listError } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .list(userId, {
        limit: 10,
        search: PROFILE_PHOTO_NAME,
      });

    if (listError) {
      if (/bucket not found/i.test(String(listError.message || ""))) {
        console.warn("Profile photo bucket is not configured yet.");
      }
      setProfilePhotoUrl("");
      return;
    }

    const exists = (files || []).some(
      (file) => file.name === PROFILE_PHOTO_NAME
    );

    if (!exists) {
      setProfilePhotoUrl("");
      return;
    }

    const { data, error } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrl(`${userId}/${PROFILE_PHOTO_NAME}`, 60 * 60);

    if (error) throw error;

    setProfilePhotoUrl(data?.signedUrl || "");
  } catch (error) {
    console.error("Profile photo load error:", error);
    setProfilePhotoUrl("");
  }
}, [session?.user?.id]);

const compressProfilePhoto = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const size = 256;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Image processing is not supported in this browser.");
        }

        canvas.width = size;
        canvas.height = size;

        const crop = Math.min(image.width, image.height);
        const sx = Math.max((image.width - crop) / 2, 0);
        const sy = Math.max((image.height - crop) / 2, 0);

        ctx.drawImage(
          image,
          sx,
          sy,
          crop,
          crop,
          0,
          0,
          size,
          size
        );

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);

            if (!blob) {
              reject(new Error("Unable to prepare profile photo."));
              return;
            }

            resolve(blob);
          },
          "image/webp",
          0.76
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read this image file."));
    };

    image.src = objectUrl;
  });

const uploadProfilePhoto = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";

  if (!file) return;

  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }

  if (!file.type.startsWith("image/")) {
    setProfileMessage("Please choose an image file.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setProfileMessage("Please choose an image smaller than 5 MB.");
    return;
  }

  try {
    setProfilePhotoBusy(true);
    setProfileMessage("Preparing photo...");

    const blob = await compressProfilePhoto(file);
    const path = `${session.user.id}/${PROFILE_PHOTO_NAME}`;

    const { error } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(path, blob, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "3600",
      });

    if (error) throw error;

    await loadProfilePhoto();
    setProfileMessage("Profile photo updated.");
  } catch (error) {
    console.error("Profile photo upload error:", error);
    setProfileMessage(
      `Unable to upload photo. ${error?.message || error}`
    );
  } finally {
    setProfilePhotoBusy(false);
  }
};

const removeProfilePhoto = async () => {
  if (!session?.user?.id || !profilePhotoUrl) return;

  if (!window.confirm("Remove your profile photo?")) return;

  try {
    setProfilePhotoBusy(true);
    setProfileMessage("");

    const path = `${session.user.id}/${PROFILE_PHOTO_NAME}`;

    const { error } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .remove([path]);

    if (error) throw error;

    setProfilePhotoUrl("");
    setProfileMessage("Profile photo removed.");
  } catch (error) {
    console.error("Profile photo remove error:", error);
    setProfileMessage(
      `Unable to remove photo. ${error?.message || error}`
    );
  } finally {
    setProfilePhotoBusy(false);
  }
};

useEffect(() => {
  if (!session?.user?.id) {
    setProfilePhotoUrl("");
    setProfileMenuOpen(false);
    setProfileMessage("");
    return;
  }

  loadProfilePhoto();
}, [session?.user?.id, loadProfilePhoto]);


/* =========================
   LOGIN
========================= */

const handleLogin = async (e) => {
  e.preventDefault();

  setAuthError("");

  if (!username.trim() || !password) {
    setAuthError(
      "Please enter username and password."
    );
    return;
  }

  setAuthSaving(true);

  try {
    const authEmail =
      `${username.trim().toLowerCase()}@mazahishob.local`;

    const { error } =
      await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

    if (error) {
      throw error;
    }

    setUsername("");
    setPassword("");
  } catch (error) {
    console.error("Login error:", error);

    setAuthError(
      error.message ||
        "Unable to login."
    );
  } finally {
    setAuthSaving(false);
  }
};


/* =========================
   LOGOUT
========================= */

const clearSignedInState = useCallback(() => {
  clearLastActivityAt();
  setSession(null);
  setExpenses([]);
  setIncomes([]);
  setLoans([]);
  setEmiPayments([]);
  setPrepaymentPayments([]);
  setProfileMenuOpen(false);
  setProfilePhotoUrl("");
  setProfileMessage("");
  setDriveConnected(false);
  setDriveBackups([]);
  setSelectedDriveBackupId("");
  setSessionWarningOpen(false);
  setSessionSecondsLeft(30);
  sessionStorage.removeItem("mh_drive_connect_pending_v2");
  sessionStorage.removeItem("mh_drive_connected_v2");
  sessionStorage.removeItem("mh_drive_access_token_v2");
  sessionStorage.removeItem("mh_drive_refresh_token_v2");
  setDriveAccessToken("");
  navigateTo("home");
  setLoading(false);
}, [navigateTo]);

const handleLogout = async () => {
  try {
    await supabase.auth.signOut();
    clearSignedInState();
  } catch (error) {
    console.error("Logout error:", error);
  }
};

/* =========================
   5-MINUTE INACTIVITY AUTO LOGOUT
   Works across web tabs and after an Android app resume.
========================= */

useEffect(() => {
  if (!session?.user?.id) return undefined;

  let lastActivityAt = readLastActivityAt() || writeLastActivityAt();
  let warningTimer;
  let logoutTimer;
  let countdownTimer;
  let nativeAppStateListener;
  let disposed = false;
  let logoutInProgress = false;
  let lastHandledActivityAt = 0;

  const clearTimers = () => {
    window.clearTimeout(warningTimer);
    window.clearTimeout(logoutTimer);
    window.clearInterval(countdownTimer);
  };

  const getLatestActivityAt = () => {
    const storedActivityAt = readLastActivityAt();
    if (storedActivityAt > lastActivityAt) lastActivityAt = storedActivityAt;
    return lastActivityAt;
  };

  const getRemainingMs = () =>
    INACTIVITY_LIMIT_MS - (Date.now() - getLatestActivityAt());

  const performAutoLogout = async () => {
    if (logoutInProgress || disposed) return;

    const remainingMs = getRemainingMs();
    if (remainingMs > 0) {
      scheduleTimers();
      return;
    }

    logoutInProgress = true;
    clearTimers();

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Automatic logout error:", error);
    } finally {
      if (!disposed) {
        clearSignedInState();
        setAuthError(
          "Session expired after 5 minutes of inactivity. Please sign in again."
        );
      }
    }
  };

  const updateCountdown = () => {
    const remainingMs = getRemainingMs();
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    setSessionSecondsLeft(remainingSeconds);
    if (remainingMs <= 0) performAutoLogout();
  };

  const showWarning = () => {
    if (disposed) return;

    const remainingMs = getRemainingMs();
    if (remainingMs <= 0) {
      performAutoLogout();
      return;
    }

    setSessionWarningOpen(true);
    updateCountdown();
    window.clearInterval(countdownTimer);
    countdownTimer = window.setInterval(updateCountdown, 1000);
  };

  function scheduleTimers() {
    clearTimers();

    const remainingMs = getRemainingMs();
    if (remainingMs <= 0) {
      performAutoLogout();
      return;
    }

    setSessionWarningOpen(false);
    setSessionSecondsLeft(Math.ceil(INACTIVITY_WARNING_MS / 1000));

    const warningDelay = remainingMs - INACTIVITY_WARNING_MS;
    if (warningDelay <= 0) showWarning();
    else warningTimer = window.setTimeout(showWarning, warningDelay);

    logoutTimer = window.setTimeout(performAutoLogout, remainingMs + 50);
  }

  const markActivity = () => {
    const now = Date.now();

    // Avoid excessive storage writes during continuous scrolling.
    if (now - lastHandledActivityAt < 750) return;
    lastHandledActivityAt = now;
    lastActivityAt = writeLastActivityAt(now);
    scheduleTimers();
  };

  const checkAfterResume = () => {
    if (getRemainingMs() <= 0) performAutoLogout();
    else markActivity();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") checkAfterResume();
  };

  const onStorage = (event) => {
    if (event.key !== LAST_ACTIVITY_STORAGE_KEY || !event.newValue) return;
    lastActivityAt = Number(event.newValue) || lastActivityAt;
    scheduleTimers();
  };

  const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"];

  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, markActivity, { passive: true });
  });
  window.addEventListener("focus", checkAfterResume);
  window.addEventListener("pageshow", checkAfterResume);
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onVisibilityChange);

  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) checkAfterResume();
    }).then((listener) => {
      if (disposed) listener.remove();
      else nativeAppStateListener = listener;
    }).catch((error) => {
      console.error("Unable to monitor native app activity:", error);
    });
  }

  window.__mhStaySignedIn = markActivity;
  scheduleTimers();

  return () => {
    disposed = true;
    clearTimers();
    activityEvents.forEach((eventName) => {
      window.removeEventListener(eventName, markActivity);
    });
    window.removeEventListener("focus", checkAfterResume);
    window.removeEventListener("pageshow", checkAfterResume);
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    nativeAppStateListener?.remove();
    delete window.__mhStaySignedIn;
  };
}, [session?.user?.id, clearSignedInState]);


/* =========================
   LOAD ALL DATA
========================= */

const SUPABASE_PAGE_SIZE = 500;

const fetchAllUserRows = useCallback(async (table, userId) => {
  const allRows = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) throw error;

    const pageRows = data || [];
    allRows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) break;
  }

  return allRows;
}, []);

const signedInUserId = session?.user?.id;

const loadAllData = useCallback(async function loadAllDataForSession(
  retryAttempt = 0
) {
  if (!signedInUserId) {
    console.log("LOAD DATA SKIPPED: No logged-in user");
    return;
  }

  console.log(
    "LOAD DATA START - USER:",
    signedInUserId
  );

  setLoading(true);

  try {
    const userId = signedInUserId;

    const [
      expenseRows,
      incomeRows,
      loanRows,
      emiRows,
      prepaymentRows,
    ] = await Promise.all([
      fetchAllUserRows("expenses", userId),
      fetchAllUserRows("incomes", userId),
      fetchAllUserRows("loans", userId),
      fetchAllUserRows("emi_payments", userId),
      fetchAllUserRows("prepayment_payments", userId),
    ]);

    setExpenses(
      expenseRows.map(
        normalizeExpense
      )
    );

    setIncomes(
      incomeRows.map(
        normalizeIncome
      )
    );

    setLoans(
      loanRows.map(
        normalizeLoan
      )
    );

    setEmiPayments(
      emiRows.map(
        normalizeEmiPayment
      )
    );

    setPrepaymentPayments(
      prepaymentRows.map(
        normalizePrepaymentPayment
      )
    );

    console.log("USER DATA LOADED SUCCESSFULLY", {
      expenses: expenseRows.length,
      incomes: incomeRows.length,
      loans: loanRows.length,
      emiPayments: emiRows.length,
      prepaymentPayments: prepaymentRows.length,
    });
  } catch (error) {
    console.error(
      "Supabase loading error:",
      error
    );

    const message = String(
      error?.message || error || ""
    );

    const jwtIssuedInFuture =
      /jwt\s+issued\s+at\s+future|issued\s+at\s+future/i.test(
        message
      );

    /*
      Supabase can occasionally return a temporary
      clock-skew error immediately after OAuth login.
      Wait briefly and retry before showing an error.
    */
    if (
      jwtIssuedInFuture &&
      retryAttempt < 2
    ) {
      const waitMs =
        retryAttempt === 0 ? 3000 : 5000;

      console.warn(
        `JWT clock-skew detected. Retrying in ${waitMs}ms...`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, waitMs)
      );

      return loadAllDataForSession(
        retryAttempt + 1
      );
    }

    alert(
      `Unable to load data from Supabase.\n\n${
        jwtIssuedInFuture
          ? "Temporary authentication clock mismatch. Please wait a few seconds and refresh the page."
          : message
      }`
    );
  } finally {
    setLoading(false);
  }
}, [fetchAllUserRows, signedInUserId]);

/* =========================
   LOAD DATA AFTER LOGIN
========================= */

useEffect(() => {
  if (!signedInUserId) {
    setLoading(false);
    return;
  }

  loadAllData();
}, [signedInUserId, loadAllData]);

  /* =========================
     CALCULATIONS
  ========================= */

  const matchesSelectedPeriod = useCallback((dateValue) => {
    const value = String(dateValue || "").slice(0, 10);

    if (!value) return false;

    if (periodType === "all") return true;

    if (periodType === "yearly") {
      return value.slice(0, 4) === String(filterYear);
    }

    if (periodType === "custom") {
      const afterFrom = !customFrom || value >= customFrom;
      const beforeTo = !customTo || value <= customTo;
      return afterFrom && beforeTo;
    }

    return getMonthKey(value) === month;
  }, [periodType, filterYear, customFrom, customTo, month]);

  const monthExpenses = useMemo(
    () => expenses.filter((x) => matchesSelectedPeriod(x.date)),
    [expenses, matchesSelectedPeriod]
  );

  const monthIncomes = useMemo(
    () => incomes.filter((x) => matchesSelectedPeriod(x.date)),
    [incomes, matchesSelectedPeriod]
  );

  const totalIncome = incomes.reduce(
    (s, x) => s + Number(x.amount || 0),
    0
  );

  const todayKey = getToday();

  const lifetimeExpenses = useMemo(
    () =>
      expenses.filter((item) => {
        const date = String(item.date || "").slice(0, 10);
        return date && date <= todayKey;
      }),
    [expenses, todayKey]
  );

  const lifetimeIncomes = useMemo(
    () =>
      incomes.filter((item) => {
        const date = String(item.date || "").slice(0, 10);
        return date && date <= todayKey;
      }),
    [incomes, todayKey]
  );

  const lifetimeExpenseTotal = useMemo(
    () =>
      lifetimeExpenses.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
    [lifetimeExpenses]
  );

  const lifetimeIncomeTotal = useMemo(
    () =>
      lifetimeIncomes.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
    [lifetimeIncomes]
  );

  const lifetimeSavings = lifetimeIncomeTotal - lifetimeExpenseTotal;
  const lifetimeBalance = lifetimeSavings;

  const lifetimeStartDate = useMemo(() => {
    const dates = [...lifetimeExpenses, ...lifetimeIncomes]
      .map((item) => String(item.date || "").slice(0, 10))
      .filter(Boolean)
      .sort();

    return dates[0] || "";
  }, [lifetimeExpenses, lifetimeIncomes]);

  const lifetimeDateLabel = lifetimeStartDate
    ? `From ${new Date(`${lifetimeStartDate}T00:00:00`).toLocaleDateString(
        "en-IN",
        { day: "2-digit", month: "short", year: "numeric" }
      )} to Today`
    : "No transactions recorded yet";

  const dashboardMonthExpenses = useMemo(
    () => expenses.filter((item) => getMonthKey(item.date) === month),
    [expenses, month]
  );

  const dashboardMonthIncomes = useMemo(
    () => incomes.filter((item) => getMonthKey(item.date) === month),
    [incomes, month]
  );

  const dashboardMonthExpenseTotal = useMemo(
    () =>
      dashboardMonthExpenses.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
    [dashboardMonthExpenses]
  );

  const dashboardMonthIncomeTotal = useMemo(
    () =>
      dashboardMonthIncomes.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
    [dashboardMonthIncomes]
  );

  const dashboardMonthSavings =
    dashboardMonthIncomeTotal - dashboardMonthExpenseTotal;

  const dashboardMonthLabel = new Date(
    `${month || getMonthKey(todayKey)}-01T00:00:00`
  ).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const dashboardYears = useMemo(() => {
    const transactionYears = [...expenses, ...incomes]
      .map((item) => Number(String(item.date || "").slice(0, 4)))
      .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 2200);
    const currentYear = new Date().getFullYear();
    const selectedDashboardYear =
      Number(String(month || "").slice(0, 4)) || currentYear;
    const selectedLedgerYear =
      Number(String(expenseLedgerDate || "").slice(0, 4)) || currentYear;
    const firstYear = Math.min(
      currentYear - 20,
      selectedDashboardYear,
      selectedLedgerYear,
      ...transactionYears
    );
    const lastYear = Math.max(
      currentYear + 10,
      selectedDashboardYear,
      selectedLedgerYear,
      ...transactionYears
    );

    return Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => firstYear + index
    );
  }, [expenses, incomes, month, expenseLedgerDate]);

  const monthExpenseTotal = monthExpenses.reduce(
    (s, x) => s + Number(x.amount || 0),
    0
  );

  const monthIncomeTotal = monthIncomes.reduce(
    (s, x) => s + Number(x.amount || 0),
    0
  );

  const monthSavings =
    monthIncomeTotal - monthExpenseTotal;

  const privateMoney = (value) =>
    amountsVisible ? money(value) : "₹ ••••••";

  const lifetimePrivateMoney = (value) =>
    lifetimeAmountsVisible ? money(value) : "₹ ••••••";

  const expenseSuggestions = useMemo(() => {
    const suggestionsByName = new Map();

    expenses.forEach((item) => {
      const note = String(item.note || "").trim();
      const key = note.toLocaleLowerCase("en-IN");

      if (!note || suggestionsByName.has(key)) return;

      suggestionsByName.set(key, {
        note,
      });
    });

    return Array.from(suggestionsByName.values());
  }, [expenses]);

  const matchingExpenseSuggestions = useMemo(() => {
    const query = String(expenseForm.note || "")
      .trim()
      .toLocaleLowerCase("en-IN");

    return expenseSuggestions
      .filter(
        (item) =>
          !query || item.note.toLocaleLowerCase("en-IN").includes(query)
      )
      .slice(0, 6);
  }, [expenseSuggestions, expenseForm.note]);

  const applyExpenseSuggestion = (suggestion) => {
    setExpenseForm((current) => ({
      ...current,
      note: suggestion.note,
    }));
    setExpenseSuggestionOpen(false);
  };

  const ledgerEntrySuggestions = useMemo(() => {
    const suggestionsByName = new Map();
    const sourceItems = ledgerEntryType === "expense" ? expenses : incomes;

    sourceItems.forEach((item) => {
      const fallbackName =
        ledgerEntryType === "expense" ? item.category : item.source;
      const description = String(item.note || "").trim();
      const label = description || String(fallbackName || "").trim();
      const key = label.toLocaleLowerCase("en-IN");

      if (!label || suggestionsByName.has(key)) return;

      suggestionsByName.set(key, {
        label,
        description: description || label,
      });
    });

    return Array.from(suggestionsByName.values());
  }, [ledgerEntryType, expenses, incomes]);

  const matchingLedgerSuggestions = useMemo(() => {
    const query = String(ledgerQuickForm.description || "")
      .trim()
      .toLocaleLowerCase("en-IN");

    return ledgerEntrySuggestions
      .filter(
        (suggestion) =>
          !query || suggestion.label.toLocaleLowerCase("en-IN").includes(query)
      )
      .slice(0, 6);
  }, [ledgerEntrySuggestions, ledgerQuickForm.description]);

  const applyLedgerSuggestion = (suggestion) => {
    setLedgerQuickForm((current) => ({
      ...current,
      description: suggestion.description || suggestion.label,
    }));
    setLedgerSuggestionOpen(false);
  };

  const trackedPrincipalPaid = useMemo(
    () =>
      emiPayments.reduce(
        (sum, payment) => sum + Number(payment.principalPaid || 0),
        0
      ) +
      prepaymentPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0
      ),
    [emiPayments, prepaymentPayments]
  );

  const trackedInterestPaid = useMemo(
    () =>
      emiPayments.reduce(
        (sum, payment) => sum + Number(payment.interestPaid || 0),
        0
      ),
    [emiPayments]
  );

  const historicalPrincipalPaid = useMemo(
    () =>
      loans.reduce(
        (sum, loan) => sum + Number(loan.principalPaidTillDate || 0),
        0
      ),
    [loans]
  );

  const historicalInterestPaid = useMemo(
    () =>
      loans.reduce(
        (sum, loan) => sum + Number(loan.interestPaidTillDate || 0),
        0
      ),
    [loans]
  );

  const filteredIncomes = useMemo(() => {
    const q = search.trim().toLowerCase();

    return incomes.filter((x) => {
      const incomeDate = String(x.date || "").slice(0, 10);

      const matchesSearch =
        !q ||
        String(x.source || "").toLowerCase().includes(q) ||
        String(x.note || "").toLowerCase().includes(q) ||
        String(x.paymentMode || "").toLowerCase().includes(q) ||
        incomeDate.toLowerCase().includes(q) ||
        String(x.amount || "").toLowerCase().includes(q);

      const matchesMode =
        filterMode === "All" ||
        String(x.paymentMode || "") === String(filterMode);

      return (
        matchesSearch &&
        matchesMode &&
        matchesSelectedPeriod(incomeDate)
      );
    });
  }, [
    incomes,
    search,
    filterMode,
    matchesSelectedPeriod,
  ]);

  const expenseLedgerPeriod = useMemo(() => {
    const selected = new Date(`${expenseLedgerDate}T00:00:00`);
    let start;
    let end;

    if (expenseLedgerView === "yearly") {
      start = new Date(selected.getFullYear(), 0, 1);
      end = new Date(selected.getFullYear(), 11, 31);
    } else if (expenseLedgerView === "monthly") {
      start = new Date(selected.getFullYear(), selected.getMonth(), 1);
      end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    } else {
      start = new Date(selected);
      end = new Date(selected);
    }

    const dateKey = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    return { start: dateKey(start), end: dateKey(end) };
  }, [expenseLedgerDate, expenseLedgerView]);

  const expenseLedgerData = useMemo(() => {
    const { start, end } = expenseLedgerPeriod;
    const inRange = (value) => {
      const date = String(value || "").slice(0, 10);
      return date >= start && date <= end;
    };
    const beforeRange = (value) => String(value || "").slice(0, 10) < start;

    const periodExpenses = expenses.filter((item) => inRange(item.date));
    const periodIncomes = incomes.filter((item) => inRange(item.date));
    const carryForward =
      incomes.filter((item) => beforeRange(item.date)).reduce((sum, item) => sum + Number(item.amount || 0), 0) -
      expenses.filter((item) => beforeRange(item.date)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const credit = periodIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const debit = periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      expenses: periodExpenses.sort((a, b) => String(b.date).localeCompare(String(a.date))),
      incomes: periodIncomes.sort((a, b) => String(b.date).localeCompare(String(a.date))),
      carryForward,
      credit,
      debit,
      balance: carryForward + credit - debit,
    };
  }, [expenses, incomes, expenseLedgerPeriod]);

  const ledgerSelectedDate = new Date(`${expenseLedgerDate}T00:00:00`);
  const ledgerDayNumber = ledgerSelectedDate.getDate();
  const ledgerSelectedMonth = String(ledgerSelectedDate.getMonth() + 1).padStart(
    2,
    "0"
  );
  const ledgerSelectedYear = ledgerSelectedDate.getFullYear();
  const ledgerSelectedMonthLabel =
    dashboardMonths.find(([value]) => value === ledgerSelectedMonth)?.[1] ||
    ledgerSelectedDate.toLocaleDateString("en-IN", { month: "long" });
  const ledgerWeekday = ledgerSelectedDate.toLocaleDateString("en-IN", {
    weekday: "long",
  });

  const ledgerPickerYears = useMemo(() => {
    const transactionYears = [...expenses, ...incomes]
      .map((item) => Number(String(item.date || "").slice(0, 4)))
      .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 2200);
    const currentYear = new Date().getFullYear();
    const selectedYear =
      Number(String(expenseLedgerDate || "").slice(0, 4)) || currentYear;
    const firstYear = transactionYears.length
      ? Math.min(currentYear, selectedYear, ...transactionYears)
      : Math.min(currentYear - 4, selectedYear);
    const lastYear = transactionYears.length
      ? Math.max(currentYear, selectedYear, ...transactionYears)
      : Math.max(currentYear, selectedYear);

    return Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => firstYear + index
    );
  }, [expenses, incomes, expenseLedgerDate]);

  const yearlyOverviewRows = useMemo(() => {
    const selectedYear = Number(String(expenseLedgerDate || "").slice(0, 4));

    return dashboardMonths.map(([monthValue, monthLabel]) => {
        const monthKey = `${selectedYear}-${monthValue}`;
        const income = incomes
          .filter((item) => getMonthKey(item.date) === monthKey)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const expense = expenses
          .filter((item) => getMonthKey(item.date) === monthKey)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        return {
          monthValue,
          monthLabel,
          income,
          expense,
          balance: income - expense,
        };
      });
  }, [expenses, incomes, expenseLedgerDate]);

  const yearlyOverviewTotal = useMemo(
    () =>
      yearlyOverviewRows.reduce(
        (total, row) => ({
          income: total.income + row.income,
          expense: total.expense + row.expense,
          balance: total.balance + row.balance,
        }),
        { income: 0, expense: 0, balance: 0 }
      ),
    [yearlyOverviewRows]
  );

  const ledgerMonthYearLabel = ledgerSelectedDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const ledgerStatementPeriodLabel =
    expenseLedgerView === "yearly"
      ? `January - December ${ledgerSelectedYear}`
      : ledgerMonthYearLabel;

  const ledgerStatementEntries = useMemo(() => {
    const incomeEntries = expenseLedgerData.incomes.map((item, index) => ({
      key: `income-${item.id || `${item.date}-${index}`}`,
      date: String(item.date || "").slice(0, 10),
      type: "Income",
      entryName: item.note || item.source || "Income",
      category: item.source || "Other",
      paymentMode: item.paymentMode || "Bank Transfer",
      amount: Number(item.amount || 0),
      createdAt: item.createdAt || "",
    }));

    const expenseEntries = expenseLedgerData.expenses.map((item, index) => ({
      key: `expense-${item.id || `${item.date}-${index}`}`,
      date: String(item.date || "").slice(0, 10),
      type: "Expense",
      entryName: item.note || item.category || "Expense",
      category: item.category || "Other",
      paymentMode: item.paymentMode || "Cash",
      amount: Number(item.amount || 0),
      createdAt: item.createdAt || "",
    }));

    return [...incomeEntries, ...expenseEntries].sort((a, b) => {
      const dateOrder = a.date.localeCompare(b.date);
      if (dateOrder) return dateOrder;

      const createdOrder = String(a.createdAt).localeCompare(String(b.createdAt));
      if (createdOrder) return createdOrder;

      return a.key.localeCompare(b.key);
    });
  }, [expenseLedgerData]);

  const monthlyLedgerDayGroups = useMemo(() => {
    if (expenseLedgerView !== "monthly") return [];

    const groupsByDate = new Map();

    ledgerStatementEntries.forEach((entry) => {
      if (!entry.date) return;

      if (!groupsByDate.has(entry.date)) {
        groupsByDate.set(entry.date, {
          date: entry.date,
          incomes: [],
          expenses: [],
        });
      }

      const group = groupsByDate.get(entry.date);
      if (entry.type === "Income") group.incomes.push(entry);
      else group.expenses.push(entry);
    });

    let runningBalance = expenseLedgerData.carryForward;
    const chronologicalGroups = Array.from(groupsByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return chronologicalGroups
      .map((group) => {
        const incomeTotal = group.incomes.reduce(
          (sum, entry) => sum + entry.amount,
          0
        );
        const expenseTotal = group.expenses.reduce(
          (sum, entry) => sum + entry.amount,
          0
        );

        runningBalance += incomeTotal - expenseTotal;

        return {
          ...group,
          incomeTotal,
          expenseTotal,
          balance: runningBalance,
        };
      })
      .reverse();
  }, [expenseLedgerView, ledgerStatementEntries, expenseLedgerData.carryForward]);

  const formatLedgerDayHeading = (dateValue) =>
    new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });

  const formatLedgerPrintDate = (dateValue) => {
    const [year, monthValue, day] = String(dateValue || "").split("-");
    return year && monthValue && day
      ? `${day}-${monthValue}-${year}`
      : String(dateValue || "");
  };

  const openLedgerComposer = (entryType = "expense") => {
    setLedgerEntryType(entryType);
    setLedgerQuickForm({
      name: entryType === "expense" ? "Food" : "Salary",
      amount: "",
      description: "",
      paymentMode: entryType === "expense" ? "UPI" : "Bank Transfer",
    });
    setLedgerSuggestionOpen(false);
    setLedgerPeriodPicker(null);
    setLedgerComposerOpen(true);
  };

  const openExpenseLedgerFromDashboard = () => {
    setExpenseLedgerDate(getToday());
    setExpenseLedgerView("daily");
    setLedgerComposerOpen(false);
    setLedgerSuggestionOpen(false);
    navigateTo("expenses");
  };

  const changeLedgerEntryType = (entryType) => {
    setLedgerEntryType(entryType);
    setLedgerQuickForm((current) => ({
      ...current,
      name: entryType === "expense" ? "Food" : "Salary",
      paymentMode: entryType === "expense" ? "UPI" : "Bank Transfer",
    }));
    setLedgerSuggestionOpen(false);
  };

  const updateExpenseLedgerDate = ({ year, monthNumber, day } = {}) => {
    const current = new Date(`${expenseLedgerDate}T00:00:00`);
    const nextYear = Number(year ?? current.getFullYear());
    const nextMonth = Number(monthNumber ?? current.getMonth() + 1);
    const requestedDay = Number(day ?? current.getDate());
    const lastDayOfMonth = new Date(nextYear, nextMonth, 0).getDate();
    const safeDay = Math.min(Math.max(requestedDay, 1), lastDayOfMonth);

    setExpenseLedgerDate(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(safeDay).padStart(
        2,
        "0"
      )}`
    );
  };

  const openLedgerPeriodPicker = (pickerType) => {
    setLedgerPickerMonth(ledgerSelectedMonth);
    setLedgerPickerYear(ledgerSelectedYear);
    setLedgerPeriodPicker(pickerType);
  };

  const applyLedgerMonthPicker = () => {
    updateExpenseLedgerDate({
      year: ledgerPickerYear,
      monthNumber: Number(ledgerPickerMonth),
      day: expenseLedgerView === "monthly" ? 1 : undefined,
    });
    setLedgerPeriodPicker(null);
  };

  const selectLedgerYear = (year) => {
    updateExpenseLedgerDate({
      year,
      day: expenseLedgerView === "yearly" ? 1 : undefined,
    });
    setLedgerPeriodPicker(null);
  };

  const shiftExpenseLedgerPeriod = (direction) => {
    const next = new Date(`${expenseLedgerDate}T00:00:00`);
    if (expenseLedgerView === "yearly") {
      next.setFullYear(next.getFullYear() + direction, 0, 1);
    } else if (expenseLedgerView === "monthly") {
      next.setMonth(next.getMonth() + direction, 1);
    } else {
      next.setDate(next.getDate() + direction);
    }

    setExpenseLedgerDate(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(
        next.getDate()
      ).padStart(2, "0")}`
    );
  };

  const exportExpenseLedgerPdf = async () => {
    if (!ledgerStatementEntries.length) {
      alert(`No entries found for ${ledgerStatementPeriodLabel}.`);
      return;
    }

    const periodKey =
      expenseLedgerView === "yearly"
        ? String(ledgerSelectedYear)
        : `${ledgerSelectedYear}-${ledgerSelectedMonth}`;

    try {
      setSaving(true);
      await exportLedgerStatementPdf({
        view: expenseLedgerView,
        periodLabel: ledgerStatementPeriodLabel,
        periodKey,
        entries: ledgerStatementEntries,
        summary: {
          carryForward: expenseLedgerData.carryForward,
          income: expenseLedgerData.credit,
          expense: expenseLedgerData.debit,
          balance: expenseLedgerData.balance,
        },
      });
    } catch (error) {
      console.error("PDF export error:", error);
      alert(`Unable to create PDF.\n\n${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const saveLedgerQuickEntry = async (event) => {
    event.preventDefault();

    if (!ledgerQuickForm.amount || Number(ledgerQuickForm.amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (!session?.user?.id) {
      alert("Please login again.");
      return;
    }

    setSaving(true);

    try {
      const userId = session.user.id;

      if (ledgerEntryType === "expense") {
        const { data, error } = await supabase
          .from("expenses")
          .insert({
            user_id: userId,
            amount: Number(ledgerQuickForm.amount),
            category: ledgerQuickForm.name || "Other",
            date: expenseLedgerDate || getToday(),
            payment_mode: ledgerQuickForm.paymentMode || "UPI",
            note: ledgerQuickForm.description || "",
          })
          .select()
          .single();

        if (error) throw error;

        setExpenses((current) => [normalizeExpense(data), ...current]);
      } else {
        const { data, error } = await supabase
          .from("incomes")
          .insert({
            user_id: userId,
            amount: Number(ledgerQuickForm.amount),
            source: ledgerQuickForm.name || "Other",
            date: expenseLedgerDate || getToday(),
            payment_mode: ledgerQuickForm.paymentMode || "Bank Transfer",
            note: ledgerQuickForm.description || "",
          })
          .select()
          .single();

        if (error) throw error;

        setIncomes((current) => [normalizeIncome(data), ...current]);
      }

      setLedgerQuickForm({
        name: ledgerEntryType === "expense" ? "Food" : "Salary",
        amount: "",
        description: "",
        paymentMode: ledgerEntryType === "expense" ? "UPI" : "Bank Transfer",
      });
      setLedgerSuggestionOpen(false);
      setLedgerComposerOpen(false);
    } catch (error) {
      console.error("Quick ledger save error:", error);
      alert(`Unable to save entry.\n\n${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

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

  const dashboardCategoryTotals = useMemo(() => {
    return categories
      .map((category) => ({
        category,
        amount: dashboardMonthExpenses
          .filter((item) => item.category === category)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [dashboardMonthExpenses]);

  const monthLabel = (() => {
    if (periodType === "all") return "All Time";
    if (periodType === "yearly") return `Year ${filterYear}`;
    if (periodType === "custom") {
      if (customFrom && customTo) return `${customFrom} to ${customTo}`;
      if (customFrom) return `From ${customFrom}`;
      if (customTo) return `Up to ${customTo}`;
      return "Custom Range";
    }

    return new Date(`${month}-01T00:00:00`).toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    });
  })();
const last6Months = useMemo(() => {
  const result = [];

  const selectedDate = new Date(
    `${month}-01T00:00:00`
  );

  for (let i = 5; i >= 0; i--) {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() - i);

    const year = d.getFullYear();
    const monthNumber = String(
      d.getMonth() + 1
    ).padStart(2, "0");

    const monthKey =
      `${year}-${monthNumber}`;

    const income = incomes
      .filter(
        (x) =>
          String(
            x.date || ""
          ).slice(0, 7) === monthKey
      )
      .reduce(
        (sum, x) =>
          sum + Number(x.amount || 0),
        0
      );

    const expense = expenses
      .filter(
        (x) =>
          String(
            x.date || ""
          ).slice(0, 7) === monthKey
      )
      .reduce(
        (sum, x) =>
          sum + Number(x.amount || 0),
        0
      );

    result.push({
      monthKey,
      label: d.toLocaleString(
        "en-IN",
        { month: "short" }
      ),
      income,
      expense,
      savings:
        income - expense,
    });
  }

  return result;
}, [month, incomes, expenses]);

  const dashboardCategoryColors = [
    "#28c8a7",
    "#278de4",
    "#ef405b",
    "#8b63d9",
    "#f39a2e",
    "#58b8d7",
    "#d45c8f",
  ];

  const dashboardExpenseTotal = dashboardCategoryTotals.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const dashboardDonutStops = (() => {
    if (!dashboardExpenseTotal) {
      return "rgba(255,255,255,.08) 0 100%";
    }

    let cursor = 0;

    return dashboardCategoryTotals
      .slice(0, 7)
      .map((item, index) => {
        const pct =
          (Number(item.amount || 0) / dashboardExpenseTotal) * 100;
        const start = cursor;
        cursor += pct;
        return `${dashboardCategoryColors[index % dashboardCategoryColors.length]} ${start}% ${cursor}%`;
      })
      .join(", ");
  })();

  /* =========================
     EXPENSE
  ========================= */

  const openExpense = (item = null) => {
    setEditing(item);
    setExpenseSuggestionOpen(false);
    setLedgerComposerOpen(false);

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
            paymentMode: "UPI",
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

  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }

  setSaving(true);

  try {
    const userId = session.user.id;

    const payload = {
      user_id: userId,
      amount: Number(expenseForm.amount),
      category: expenseForm.category,
      date: expenseForm.date,
      payment_mode: expenseForm.paymentMode,
      note: expenseForm.note || "",
    };

    if (editing) {
      const { data, error } = await supabase
        .from("expenses")
        .update({
          amount: Number(expenseForm.amount),
          category: expenseForm.category,
          date: expenseForm.date,
          payment_mode: expenseForm.paymentMode,
          note: expenseForm.note || "",
        })
        .eq("id", editing.id)
        .eq("user_id", userId)
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
      const { data, error } = await supabase
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
    console.error(
      "Expense save error:",
      error
    );

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
      if (!session?.user?.id) {
        alert("Please login again.");
        return;
      }

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);

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
    setLedgerComposerOpen(false);

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

  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }

  setSaving(true);

  try {
    const userId = session.user.id;

    const payload = {
      user_id: userId,
      amount: Number(incomeForm.amount),
      source: incomeForm.source,
      date: incomeForm.date,
      payment_mode: incomeForm.paymentMode,
      note: incomeForm.note || "",
    };

    if (editing) {
      const { data, error } = await supabase
        .from("incomes")
        .update({
          amount: Number(incomeForm.amount),
          source: incomeForm.source,
          date: incomeForm.date,
          payment_mode: incomeForm.paymentMode,
          note: incomeForm.note || "",
        })
        .eq("id", editing.id)
        .eq("user_id", userId)
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
      const { data, error } = await supabase
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
    console.error(
      "Income save error:",
      error
    );

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
      if (!session?.user?.id) {
        alert("Please login again.");
        return;
      }

      const { error } = await supabase
        .from("incomes")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);

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
            loanName: loan.loanName || "",
            lender: loan.lender || "",
            amount: loan.amount ?? "",
            principalPaidTillDate: loan.principalPaidTillDate ?? "",
            interestPaidTillDate: loan.interestPaidTillDate ?? "",
            originalLoanStartDate: loan.originalLoanStartDate || "",

            outstanding: loan.outstanding ?? "",
            interestRate: loan.interestRate ?? "",
            tenure: loan.tenure ?? "",
            emi: loan.emi ?? "",
            nextEmiDate: loan.nextEmiDate || "",
            trackingDate: loan.trackingDate || "",

            loanType: loan.loanType || "Home Loan",
            note: loan.note || "",
          }
        : {
            loanName: "",
            lender: "",
            amount: "",
            principalPaidTillDate: "",
            interestPaidTillDate: "",
            originalLoanStartDate: "",

            outstanding: "",
            interestRate: "",
            tenure: "",
            emi: "",
            nextEmiDate: "",
            trackingDate: getToday(),

            loanType: "Home Loan",
            note: "",
          }
    );

    setModal("loan");
  };

  const saveLoan = async (e) => {
    e.preventDefault();

    if (!session?.user?.id) {
      alert("Please login again.");
      return;
    }

    const originalAmount = Number(loanForm.amount);
    const historicalPrincipal = Number(loanForm.principalPaidTillDate || 0);
    const historicalInterest = Number(loanForm.interestPaidTillDate || 0);
    const currentOutstanding = Number(loanForm.outstanding);
    const interestRate = Number(loanForm.interestRate);
    const pendingTenure = Number(loanForm.tenure);
    const monthlyEmi = Number(loanForm.emi);
    const trackingDate = loanForm.trackingDate;

    if (!loanForm.loanName.trim()) {
      alert("Please enter Loan Name.");
      return;
    }

    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      alert("Please enter a valid Original Loan Amount.");
      return;
    }

    if (historicalPrincipal < 0 || historicalInterest < 0) {
      alert("Historical paid amounts cannot be negative.");
      return;
    }

    if (!loanForm.originalLoanStartDate) {
      alert("Please select Original Loan Start Date.");
      return;
    }

    if (!Number.isFinite(currentOutstanding) || currentOutstanding < 0) {
      alert("Please enter a valid Current Outstanding Principal.");
      return;
    }

    if (!Number.isFinite(interestRate) || interestRate < 0) {
      alert("Please enter a valid Interest Rate.");
      return;
    }

    if (!trackingDate) {
      alert("Please select Loan Tracking Date.");
      return;
    }

    if (currentOutstanding > 0) {
      if (!Number.isFinite(monthlyEmi) || monthlyEmi <= 0) {
        alert("Please enter a valid Monthly EMI.");
        return;
      }

      if (!Number.isFinite(pendingTenure) || pendingTenure <= 0) {
        alert("Please enter a valid Pending Tenure.");
        return;
      }

      if (!loanForm.nextEmiDate) {
        alert("Please select Next EMI Date.");
        return;
      }

      if (loanForm.nextEmiDate < trackingDate) {
        alert("Next EMI Date cannot be before Loan Tracking Date.");
        return;
      }
    }

    setSaving(true);

    try {
      const userId = session.user.id;
      const status = currentOutstanding <= 0 ? "Closed" : "Active";

      const payload = {
        user_id: userId,

        /* Section 1 — historical only */
        loan_name: loanForm.loanName.trim(),
        lender: loanForm.lender.trim(),
        amount: originalAmount,
        principal_paid_till_date: historicalPrincipal,
        interest_paid_till_date: historicalInterest,
        start_date: loanForm.originalLoanStartDate,

        /* Section 2 — current calculation inputs */
        outstanding: currentOutstanding,
        interest_rate: interestRate,
        tenure: currentOutstanding > 0 ? pendingTenure : 0,
        emi: currentOutstanding > 0 ? monthlyEmi : 0,
        next_emi_date:
          currentOutstanding > 0 ? loanForm.nextEmiDate : null,
        tracking_date: trackingDate,

        /* Section 3 */
        loan_type: loanForm.loanType,
        note: loanForm.note.trim(),
        status,
      };

      const query = editing
        ? supabase
            .from("loans")
            .update(payload)
            .eq("id", editing.id)
            .eq("user_id", userId)
        : supabase.from("loans").insert(payload);

      const { data, error } = await query.select().single();

      if (error) throw error;

      const normalized = normalizeLoan(data);

      setLoans((prev) =>
        editing
          ? prev.map((x) => (x.id === editing.id ? normalized : x))
          : [normalized, ...prev]
      );

      closeModal();
    } catch (error) {
      console.error("Loan save error:", error);
      alert(`Unable to save loan.

${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

 const deleteLoan = async (id) => {
  if (
    !window.confirm(
      "Delete this loan and all its EMI and prepayment history?"
    )
  ) {
    return;
  }

  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }

  try {
    setSaving(true);
    const userId = session.user.id;

    const { error: emiError } = await supabase
      .from("emi_payments")
      .delete()
      .eq("loan_id", id)
      .eq("user_id", userId);

    if (emiError) throw emiError;

    const { error: prepaymentError } = await supabase
      .from("prepayment_payments")
      .delete()
      .eq("loan_id", String(id))
      .eq("user_id", userId);

    if (prepaymentError) throw prepaymentError;

    const { error: loanError } = await supabase
      .from("loans")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (loanError) throw loanError;

    setEmiPayments((prev) =>
      prev.filter((x) => String(x.loanId) !== String(id))
    );

    setPrepaymentPayments((prev) =>
      prev.filter((x) => String(x.loanId) !== String(id))
    );

    setLoans((prev) =>
      prev.filter((x) => String(x.id) !== String(id))
    );
  } catch (error) {
    console.error("Delete loan error:", error);
    alert(`Unable to delete loan.\n\n${error.message || error}`);
  } finally {
    setSaving(false);
  }
};

  /* =========================
     EMI
  ========================= */

  const markEmiPaid = async (loan) => {
  if (
    (loan.status || "Active") ===
    "Closed"
  ) {
    return;
  }

  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }

  const currentOutstanding = Number(
    loan.outstanding ??
      0
  );

  const emi = Number(
    loan.emi || 0
  );

  const dueDate = loan.nextEmiDate
    ? String(
        loan.nextEmiDate
      ).slice(0, 10)
    : null;

  if (!dueDate) {
    alert(
      "Next EMI date is not available."
    );
    return;
  }

  if (
    currentOutstanding <= 0 ||
    emi <= 0
  ) {
    return;
  }

  try {
    setSaving(true);

    const userId =
      session.user.id;

    /* =========================
       PREVENT DUPLICATE EMI
    ========================= */

    const {
      data: existingPayment,
      error: existingPaymentError,
    } = await supabase
      .from("emi_payments")
      .select("id")
      .eq("user_id", userId)
      .eq("loan_id", loan.id)
      .eq("emi_due_date", dueDate)
      .limit(1);

    if (existingPaymentError) {
      throw existingPaymentError;
    }

    if (
      existingPayment &&
      existingPayment.length > 0
    ) {
      alert(
        `EMI for ${dueDate} is already marked as paid.`
      );

      return;
    }

    const {
      interest,
      principal,
      actualPaymentAmount,
      newOutstanding,
      remainingTenure,
      nextDate,
      status,
    } = calculateEmiSettlement({
      outstanding: currentOutstanding,
      annualInterestRate: loan.interestRate,
      emi,
      dueDate,
      fallbackTenure: loan.tenure,
    });

    /* =========================
       EMI PAYMENT
    ========================= */

    const paymentPayload = {
      user_id: userId,
      loan_id: loan.id,
      loan_name:
        loan.loanName,
      amount:
        actualPaymentAmount,
      paid_date:
        getToday(),

      emi_due_date:
        dueDate,

      principal_paid:
        principal,

      interest_paid:
        interest,

      remaining_principal:
        newOutstanding,
    };

    const {
      data: paymentData,
      error: paymentError,
    } = await supabase
      .from("emi_payments")
      .insert(
        paymentPayload
      )
      .select()
      .single();

    if (paymentError) {
      if (paymentError.code === "23505") {
        throw new Error(`EMI for ${dueDate} is already marked as paid.`);
      }
      throw paymentError;
    }

    /* =========================
       UPDATE LOAN
    ========================= */

    const loanPayload = {
      outstanding:
        newOutstanding,

      next_emi_date:
        nextDate,

      tenure:
        remainingTenure,

      status,
    };

    const {
      data: loanData,
      error: loanError,
    } = await supabase
      .from("loans")
      .update(
        loanPayload
      )
      .eq(
        "id",
        loan.id
      )
      .eq(
        "user_id",
        userId
      )
      .select()
      .single();

    if (loanError) {
      const { error: rollbackError } = await supabase
        .from("emi_payments")
        .delete()
        .eq("id", paymentData.id)
        .eq("user_id", userId);

      if (rollbackError) {
        throw new Error(
          `${loanError.message || loanError} Automatic EMI rollback also failed: ${
            rollbackError.message || rollbackError
          }`
        );
      }

      throw loanError;
    }

    /* =========================
       UPDATE LOCAL EMI HISTORY
    ========================= */

    setEmiPayments(
      (prev) => [
        normalizeEmiPayment(
          paymentData
        ),
        ...prev,
      ]
    );

    /* =========================
       UPDATE LOCAL LOAN
    ========================= */

    setLoans(
      (prev) =>
        prev.map(
          (x) =>
            x.id ===
            loan.id
              ? normalizeLoan(
                  loanData
                )
              : x
        )
    );
  } catch (error) {
    console.error(
      "EMI payment error:",
      error
    );

    alert(
      `Unable to mark EMI as paid.\n\n${
        error.message ||
        error
      }`
    );
  } finally {
    setSaving(false);
  }
};


const deleteEmiPayment = async (id) => {
  if (
    !window.confirm(
      "Delete this EMI payment and restore the loan to the state before this payment?"
    )
  ) {
    return;
  }

  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }

  try {
    setSaving(true);
    const userId = session.user.id;

    const payment = emiPayments.find(
      (p) => String(p.id) === String(id)
    );

    if (!payment) {
      throw new Error("EMI payment record not found.");
    }

    const loan = loans.find(
      (x) => String(x.id) === String(payment.loanId)
    );

    if (!loan) {
      throw new Error("Loan linked with this EMI was not found.");
    }

    /*
     * Only the latest EMI for a loan can be reversed safely.
     * Reversing an older EMI would invalidate principal/interest
     * calculations of all later payments.
     */
    const loanPayments = emiPayments
      .filter((p) => String(p.loanId) === String(loan.id))
      .sort((a, b) => {
        const aDate = String(a.emiDueDate || a.paidDate || a.createdAt || "");
        const bDate = String(b.emiDueDate || b.paidDate || b.createdAt || "");
        return bDate.localeCompare(aDate);
      });

    const latestPayment = loanPayments[0];

    if (!latestPayment || String(latestPayment.id) !== String(id)) {
      alert(
        "For calculation safety, delete the latest EMI of this loan first. Older EMI records cannot be reversed while newer EMI payments exist."
      );
      return;
    }

    const currentOutstanding = Number(loan.outstanding ?? 0);
    const deletedPrincipal = Number(payment.principalPaid || 0);
    const restoredOutstanding = Math.max(
      currentOutstanding + deletedPrincipal,
      0
    );

    const rate = Number(loan.interestRate || 0) / 100 / 12;
    const emi = Number(loan.emi || 0);
    const restoredTenure = calculateRemainingTenure({
      outstanding: restoredOutstanding,
      monthlyRate: rate,
      emi,
      fallbackTenure: Math.max(Number(loan.tenure || 0) + 1, 1),
    });

    const restoredNextEmiDate =
      payment.emiDueDate || payment.emi_due_date || loan.nextEmiDate || null;

    const previousLoanState = {
      outstanding: currentOutstanding,
      next_emi_date: loan.nextEmiDate || null,
      tenure: Number(loan.tenure || 0),
      status: loan.status || "Active",
    };

    const loanPayload = {
      outstanding: restoredOutstanding,
      next_emi_date: restoredOutstanding > 0 ? restoredNextEmiDate : null,
      tenure: restoredTenure,
      status: restoredOutstanding > 0 ? "Active" : "Closed",
    };

    const { data: loanData, error: loanError } = await supabase
      .from("loans")
      .update(loanPayload)
      .eq("id", loan.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (loanError) throw loanError;

    const { error: paymentError } = await supabase
      .from("emi_payments")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (paymentError) {
      const { error: rollbackError } = await supabase
        .from("loans")
        .update(previousLoanState)
        .eq("id", loan.id)
        .eq("user_id", userId);

      if (rollbackError) {
        throw new Error(
          `${paymentError.message || paymentError} Automatic loan rollback also failed: ${
            rollbackError.message || rollbackError
          }`
        );
      }

      throw paymentError;
    }

    setLoans((prev) =>
      prev.map((x) =>
        String(x.id) === String(loan.id) ? normalizeLoan(loanData) : x
      )
    );

    setEmiPayments((prev) =>
      prev.filter((x) => String(x.id) !== String(id))
    );
  } catch (error) {
    console.error("Delete EMI error:", error);
    alert(`Unable to delete EMI payment.

${error.message || error}`);
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

    let newEmi;

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

    if (!session?.user?.id) {
      alert("Please login again.");
      return;
    }

    const currentOutstanding = Number(selectedLoan.outstanding ?? 0);
    const prepaymentAmount = Number(prepayForm.prepayment || 0);

    if (prepaymentAmount <= 0) {
      alert("Please enter a valid prepayment amount.");
      return;
    }

    if (prepaymentAmount > currentOutstanding) {
      alert("Prepayment cannot be greater than outstanding amount.");
      return;
    }

    const newOutstanding = Math.max(
      currentOutstanding - prepaymentAmount,
      0
    );

    try {
      setSaving(true);

      const userId = session.user.id;
      const reduceEmi = prepayForm.option === "emi";
      const oldEmi = Number(selectedLoan.emi || 0);
      const oldTenure = Number(selectedLoan.tenure || 0);
      const oldNextEmiDate = selectedLoan.nextEmiDate || null;
      const oldStatus = selectedLoan.status || "Active";

      const newTenure =
        newOutstanding > 0
          ? reduceEmi
            ? Number(prepayForm.remainingTenure || oldTenure)
            : prepayResult.newTenure
          : 0;

      const newEmi =
        newOutstanding > 0
          ? reduceEmi
            ? Number(prepayResult.newEmi || 0)
            : oldEmi
          : 0;

      const newNextEmiDate =
        newOutstanding > 0 ? oldNextEmiDate : null;

      const newStatus =
        newOutstanding <= 0 ? "Closed" : "Active";

      const historyPayload = {
        user_id: userId,
        loan_id: String(selectedLoan.id),
        loan_name: selectedLoan.loanName,
        amount: prepaymentAmount,
        paid_date: getToday(),
        strategy: reduceEmi ? "emi" : "tenure",
        old_outstanding: currentOutstanding,
        new_outstanding: newOutstanding,
        old_emi: oldEmi,
        new_emi: newEmi,
        old_tenure: oldTenure,
        new_tenure: newTenure,
        old_next_emi_date: oldNextEmiDate,
        new_next_emi_date: newNextEmiDate,
        old_status: oldStatus,
        new_status: newStatus,
      };

      const { data: historyData, error: historyError } = await supabase
        .from("prepayment_payments")
        .insert(historyPayload)
        .select()
        .single();

      if (historyError) throw historyError;

      const loanPayload = {
        outstanding: newOutstanding,
        next_emi_date: newNextEmiDate,
        tenure: newTenure,
        emi: newEmi,
        status: newStatus,
      };

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .update(loanPayload)
        .eq("id", selectedLoan.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (loanError) {
        const { error: rollbackError } = await supabase
          .from("prepayment_payments")
          .delete()
          .eq("id", historyData.id)
          .eq("user_id", userId);

        if (rollbackError) {
          throw new Error(
            `${loanError.message || loanError} Automatic prepayment rollback also failed: ${
              rollbackError.message || rollbackError
            }`
          );
        }

        throw loanError;
      }

      setLoans((prev) =>
        prev.map((x) =>
          String(x.id) === String(selectedLoan.id)
            ? normalizeLoan(loanData)
            : x
        )
      );

      setPrepaymentPayments((prev) => [
        normalizePrepaymentPayment(historyData),
        ...prev,
      ]);

      closeModal();
    } catch (error) {
      console.error("Prepayment error:", error);
      alert(`Unable to apply prepayment.\n\n${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const deletePrepaymentPayment = async (id) => {
    if (
      !window.confirm(
        "Delete this prepayment record and restore the loan to the state before this prepayment?"
      )
    ) {
      return;
    }

    if (!session?.user?.id) {
      alert("Please login again.");
      return;
    }

    const payment = prepaymentPayments.find(
      (p) => String(p.id) === String(id)
    );

    if (!payment) {
      alert("Prepayment record not found.");
      return;
    }

    const loan = loans.find(
      (x) => String(x.id) === String(payment.loanId)
    );

    if (!loan) {
      alert("Loan linked with this prepayment was not found.");
      return;
    }

    const paymentCreatedAt = String(payment.createdAt || "");

    const hasLaterEmi = emiPayments.some(
      (x) =>
        String(x.loanId) === String(payment.loanId) &&
        String(x.createdAt || "") > paymentCreatedAt
    );

    const hasLaterPrepayment = prepaymentPayments.some(
      (x) =>
        String(x.loanId) === String(payment.loanId) &&
        String(x.id) !== String(payment.id) &&
        String(x.createdAt || "") > paymentCreatedAt
    );

    if (hasLaterEmi || hasLaterPrepayment) {
      alert(
        "For calculation safety, delete later EMI or prepayment records for this loan first."
      );
      return;
    }

    try {
      setSaving(true);
      const userId = session.user.id;

      const restorePayload = {
        outstanding: Number(payment.oldOutstanding || 0),
        emi: Number(payment.oldEmi || 0),
        tenure: Number(payment.oldTenure || 0),
        next_emi_date: payment.oldNextEmiDate || null,
        status: payment.oldStatus || "Active",
      };

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .update(restorePayload)
        .eq("id", loan.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (loanError) throw loanError;

      const { error: deleteError } = await supabase
        .from("prepayment_payments")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (deleteError) {
        const rollbackPayload = {
          outstanding: Number(payment.newOutstanding || 0),
          emi: Number(payment.newEmi || 0),
          tenure: Number(payment.newTenure || 0),
          next_emi_date: payment.newNextEmiDate || null,
          status: payment.newStatus || "Active",
        };

        const { error: rollbackError } = await supabase
          .from("loans")
          .update(rollbackPayload)
          .eq("id", loan.id)
          .eq("user_id", userId);

        if (rollbackError) {
          throw new Error(
            `${deleteError.message || deleteError} Automatic loan rollback also failed: ${
              rollbackError.message || rollbackError
            }`
          );
        }

        throw deleteError;
      }

      setLoans((prev) =>
        prev.map((x) =>
          String(x.id) === String(loan.id)
            ? normalizeLoan(loanData)
            : x
        )
      );

      setPrepaymentPayments((prev) =>
        prev.filter((x) => String(x.id) !== String(id))
      );
    } catch (error) {
      console.error("Delete prepayment error:", error);
      alert(`Unable to delete prepayment.\n\n${error.message || error}`);
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
    Number(loan.outstanding ?? 0) <= 0 ||
    !loan.nextEmiDate
  ) {
    return [];
  }

  const today = getToday();
  let dueDate = String(loan.nextEmiDate).slice(0, 10);

  if (dueDate > today) {
    return [];
  }

  const pending = [];
  let safetyCounter = 0;

  while (dueDate <= today && safetyCounter < 600) {
    pending.push({
      loanId: loan.id,
      loanName: loan.loanName,
      amount: Number(loan.emi || 0),
      dueDate,
    });

    dueDate = addMonthsClamped(dueDate);
    safetyCounter += 1;
  }

  return pending;
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
     BACKUP / RESTORE
  ========================= */

  const DRIVE_BACKUP_FOLDER = "Maza Hishob Backups";

  const recordBackupTelemetry = async ({
    status,
    provider = "google_drive",
    detail = "",
  }) => {
    try {
      if (!session?.user?.id) return;

      const { error } = await supabase.rpc("record_backup_event", {
        p_status: status,
        p_provider: provider,
        p_detail: String(detail || "").slice(0, 1000),
      });

      if (error) {
        console.warn("Backup telemetry skipped:", error.message || error);
      }
    } catch (error) {
      console.warn("Backup telemetry skipped:", error);
    }
  };

  const buildBackupData = () => ({
    app: "Maza Hishob",
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    ownerEmail: session?.user?.email || "",
    expenses,
    incomes,
    loans,
    emiPayments,
    prepaymentPayments,
  });

  const getDriveAccessToken = () => {
    if (!driveConnected) {
      throw new Error(
        "Google Drive is disconnected. Connect Google Drive from Settings if you want cloud backup."
      );
    }

    const token =
      driveAccessToken ||
      sessionStorage.getItem("mh_drive_access_token_v2") ||
      session?.provider_token;

    if (!token) {
      throw new Error(
        "Google Drive permission is unavailable. Disconnect and connect Google Drive again."
      );
    }

    return token;
  };

  const driveFetch = async (url, options = {}) => {
    const token = getDriveAccessToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let details;

      try {
        const body = await response.json();
        details =
          body?.error?.message ||
          body?.error_description ||
          "";
      } catch {
        details = await response.text().catch(() => "");
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Google Drive permission needs to be refreshed${
            details ? `: ${details}` : "."
          } Disconnect and connect Google Drive again to refresh access.`
        );
      }

      throw new Error(
        `Google Drive request failed (${response.status})${
          details ? `: ${details}` : "."
        }`
      );
    }

    return response;
  };

  const getOrCreateDriveBackupFolder = async () => {
    const query = [
      `name='${DRIVE_BACKUP_FOLDER}'`,
      "mimeType='application/vnd.google-apps.folder'",
      "trashed=false",
    ].join(" and ");

    const listUrl =
      "https://www.googleapis.com/drive/v3/files" +
      `?q=${encodeURIComponent(query)}` +
      "&spaces=drive" +
      "&pageSize=10" +
      "&fields=files(id,name,createdTime)";

    const listResponse = await driveFetch(listUrl);
    const listData = await listResponse.json();

    if (listData.files?.length) {
      return listData.files[0].id;
    }

    const createResponse = await driveFetch(
      "https://www.googleapis.com/drive/v3/files?fields=id,name",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: DRIVE_BACKUP_FOLDER,
          mimeType: "application/vnd.google-apps.folder",
        }),
      }
    );

    const created = await createResponse.json();
    return created.id;
  };

  const listDriveBackups = async ({ silent = false } = {}) => {
    if (!silent) {
      setBackupMessage("");
      setDriveBusy(true);
    }

    try {
      const folderId = await getOrCreateDriveBackupFolder();
      const query = [
        `'${folderId}' in parents`,
        "trashed=false",
        "mimeType='application/json'",
      ].join(" and ");

      const url =
        "https://www.googleapis.com/drive/v3/files" +
        `?q=${encodeURIComponent(query)}` +
        "&spaces=drive" +
        "&orderBy=createdTime desc" +
        "&pageSize=50" +
        "&fields=files(id,name,createdTime,modifiedTime,size)";

      const response = await driveFetch(url);
      const data = await response.json();
      const files = data.files || [];

      setDriveBackups(files);
      setSelectedDriveBackupId((current) => {
        if (current && files.some((file) => file.id === current)) {
          return current;
        }
        return files[0]?.id || "";
      });

      if (!silent) {
        setBackupMessage(
          files.length
            ? `${files.length} Google Drive backup${
                files.length === 1 ? "" : "s"
              } found.`
            : "No Google Drive backups found yet."
        );
      }

      return files;
    } catch (error) {
      console.error("Google Drive list error:", error);
      if (!silent) {
        setBackupMessage(error?.message || String(error));
      }
      return [];
    } finally {
      if (!silent) setDriveBusy(false);
    }
  };

  const backupToGoogleDrive = async () => {
    setBackupMessage("");
    setDriveBusy(true);

    try {
      if (!session?.user?.id) {
        throw new Error("Please login again.");
      }

      const folderId = await getOrCreateDriveBackupFolder();
      const backup = buildBackupData();
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
      const fileName = `maza-hishob-backup-${stamp}.json`;
      const boundary = `mh_boundary_${Date.now()}`;

      const metadata = {
        name: fileName,
        mimeType: "application/json",
        parents: [folderId],
      };

      const multipartBody = [
        `--${boundary}\r\n`,
        "Content-Type: application/json; charset=UTF-8\r\n\r\n",
        JSON.stringify(metadata),
        `\r\n--${boundary}\r\n`,
        "Content-Type: application/json\r\n\r\n",
        JSON.stringify(backup, null, 2),
        `\r\n--${boundary}--`,
      ].join("");

      const response = await driveFetch(
        "https://www.googleapis.com/upload/drive/v3/files" +
          "?uploadType=multipart&fields=id,name,createdTime",
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      const uploaded = await response.json();

      setBackupMessage(
        `Google Drive backup saved successfully: ${uploaded.name}`
      );

      await recordBackupTelemetry({
        status: "success",
        provider: "google_drive",
        detail: `Backup saved: ${uploaded.name}`,
      });

      await listDriveBackups({ silent: true });
    } catch (error) {
      console.error("Google Drive backup error:", error);

      await recordBackupTelemetry({
        status: "failed",
        provider: "google_drive",
        detail: error?.message || String(error),
      });

      setBackupMessage(
        `Unable to back up to Google Drive. ${
          error?.message || error
        }`
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const clearUserDataInSupabase = async (userId) => {
    const tables = [
      "prepayment_payments",
      "emi_payments",
      "expenses",
      "incomes",
      "loans",
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    }
  };

  const insertRows = async (table, rows) => {
    if (!rows.length) return;

    const batchSize = 500;

    for (let from = 0; from < rows.length; from += batchSize) {
      const batch = rows.slice(from, from + batchSize);
      const { error } = await supabase
        .from(table)
        .insert(batch);

      if (error) {
        throw new Error(
          `${table} restore failed for rows ${from + 1}-${from + batch.length}. ${
            error.message || error
          }`
        );
      }
    }
  };

  const writeBackupToSupabase = async (backup, userId) => {
    const rows = mapBackupToDatabaseRows(backup, userId, getToday());

    await insertRows("loans", rows.loans);
    await insertRows("expenses", rows.expenses);
    await insertRows("incomes", rows.incomes);
    await insertRows("emi_payments", rows.emiPayments);
    await insertRows(
      "prepayment_payments",
      rows.prepaymentPayments
    );
  };

  const applyBackupToLocalState = (backup) => {
    setExpenses(
      (backup.expenses || []).map(normalizeExpense)
    );
    setIncomes(
      (backup.incomes || []).map(normalizeIncome)
    );
    setLoans((backup.loans || []).map(normalizeLoan));
    setEmiPayments(
      (backup.emiPayments || []).map(normalizeEmiPayment)
    );
    setPrepaymentPayments(
      (backup.prepaymentPayments || []).map(
        normalizePrepaymentPayment
      )
    );
  };

  const restoreBackupToSupabase = async (rawBackup) => {
    if (!session?.user?.id) {
      throw new Error("Please login again.");
    }

    const backup = validateBackupData(rawBackup, session.user.email);
    const userId = session.user.id;
    const safetySnapshot = buildBackupData();

    await restoreBackupWithRollback({
      backup,
      safetySnapshot,
      clear: () => clearUserDataInSupabase(userId),
      write: (data) => writeBackupToSupabase(data, userId),
      apply: applyBackupToLocalState,
      onRestoreError: (error) =>
        console.error("Restore failed, attempting rollback:", error),
      onRollbackError: (error) => console.error("Rollback failed:", error),
    });
  };

  const restoreFromGoogleDrive = async (backupId = selectedDriveBackupId) => {
    setBackupMessage("");

    if (!backupId) {
      setBackupMessage(
        "Select a Google Drive backup to restore."
      );
      return;
    }

    const selected = driveBackups.find(
      (file) => file.id === backupId
    );

    const confirmed = window.confirm(
      `Restore ${selected?.name || "this backup"}?\n\n` +
        "Your current Maza Hishob data will be replaced by the selected backup. A rollback copy will be kept in memory while restoring."
    );

    if (!confirmed) return;

    setDriveBusy(true);
    setSaving(true);

    try {
      const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          backupId
        )}?alt=media`
      );

      const backup = await response.json();
      await restoreBackupToSupabase(backup);

      setBackupMessage(
        `Google Drive backup restored successfully: ${
          selected?.name || "selected backup"
        }`
      );
    } catch (error) {
      console.error("Google Drive restore error:", error);
      setBackupMessage(
        `Unable to restore Google Drive backup. ${
          error?.message || error
        }`
      );
    } finally {
      setDriveBusy(false);
      setSaving(false);
    }
  };

  const deleteSelectedDriveBackup = async (backupId = selectedDriveBackupId) => {
    setBackupMessage("");

    if (!driveConnected) {
      setBackupMessage(
        "Connect Google Drive before deleting a cloud backup."
      );
      return;
    }

    if (!backupId) {
      setBackupMessage("Select a Google Drive backup to delete.");
      return;
    }

    const selected = driveBackups.find(
      (file) => file.id === backupId
    );

    const confirmed = window.confirm(
      `Permanently delete ${selected?.name || "this backup"} from Google Drive?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDriveBusy(true);

    try {
      await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          backupId
        )}`,
        { method: "DELETE" }
      );

      setBackupMessage(
        `Google Drive backup deleted successfully: ${
          selected?.name || "selected backup"
        }`
      );

      await listDriveBackups({ silent: true });
    } catch (error) {
      console.error("Google Drive delete error:", error);
      setBackupMessage(
        `Unable to delete Google Drive backup. ${
          error?.message || error
        }`
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const exportData = async () => {
    setBackupMessage("");
    setLocalBackupBusy(true);

    try {
      const result = await saveLocalBackup({
        data: buildBackupData(),
        dateValue: getToday(),
      });

      setBackupMessage(
        result.destination === "share"
          ? "Backup is ready. Choose where to save or share it."
          : `Backup downloaded successfully: ${result.filename}`
      );
    } catch (error) {
      console.error("Local backup export error:", error);
      setBackupMessage(
        `Unable to create local backup. ${error?.message || error}`
      );
    } finally {
      setLocalBackupBusy(false);
    }
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const backup = validateBackupData(
          JSON.parse(reader.result)
        );

        const confirmed = window.confirm(
          `Restore backup from ${file.name}?\n\n` +
            "Your current Maza Hishob data in Supabase will be replaced by this backup."
        );

        if (!confirmed) return;

        setSaving(true);
        await restoreBackupToSupabase(backup);
        setBackupMessage(
          "Local backup restored successfully to Supabase."
        );
      } catch (error) {
        console.error("Local backup restore error:", error);
        setBackupMessage(
          `Unable to restore backup. ${error?.message || error}`
        );
      } finally {
        setSaving(false);
        e.target.value = "";
      }
    };

    reader.readAsText(file);
  };

  const resetAll = async () => {
    if (
      !window.confirm(
        "This will permanently delete all of YOUR Maza Hishob data from Supabase. Continue?"
      )
    ) {
      return;
    }

    if (!session?.user?.id) {
      alert("Please login again.");
      return;
    }

    try {
      setSaving(true);
      const userId = session.user.id;

      const tables = ["prepayment_payments", "emi_payments", "expenses", "incomes", "loans"];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", userId);

        if (error) throw error;
      }

      setExpenses([]);
      setIncomes([]);
      setLoans([]);
      setEmiPayments([]);
      setPrepaymentPayments([]);
      setBackupMessage("All of your data has been cleared.");
    } catch (error) {
      console.error("Reset data error:", error);
      alert(`Unable to reset data.

${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setSelectedLoan(null);
    setExpenseSuggestionOpen(false);
  };

  const nav = [
    ["home", "⌂", "Home"],
    ["expenses", "◈", "Expenses"],
    ["loans", "▣", "Loans"],
    ["reports", "◫", "Reports"],
  ];
/* =========================
   AUTH PAGE — GOOGLE FIRST
========================= */

if (authLoading) {
  return (
    <div className="mh-auth-page">
      <div className="mh-auth-orb mh-auth-orb-one" />
      <div className="mh-auth-orb mh-auth-orb-two" />

      <div className="mh-auth-card mh-auth-loading-card">
        <img
          className="mh-auth-logo"
          src={mazaHishobLogo}
          alt="Maza Hishob"
        />

        <div className="mh-auth-loading-ring" />

        <h2>Checking your account</h2>

        <p>
          Securely restoring your Maza Hishob session...
        </p>
      </div>
    </div>
  );
}

if (!session) {
  return (
    <div className="mh-auth-page">
      <div className="mh-auth-orb mh-auth-orb-one" />
      <div className="mh-auth-orb mh-auth-orb-two" />
      <div className="mh-auth-grid-glow" />

      <main className="mh-auth-shell">
        <section className="mh-auth-visual">
          <div className="mh-auth-logo-halo">
            <img
              className="mh-auth-hero-logo"
              src={mazaHishobLogo}
              alt="Maza Hishob logo"
            />
          </div>

          <span className="mh-auth-kicker">
            PERSONAL FINANCE · PRIVATE BY DESIGN
          </span>

          <h1>
            Your money.
            <br />
            Your control.
          </h1>

          <p>
            Track expenses, income, loans, EMI and
            prepayments from one secure financial dashboard.
          </p>

          <div className="mh-auth-feature-row">
            <div>
              <strong>Secure</strong>
              <span>Google sign-in</span>
            </div>

            <div>
              <strong>Private</strong>
              <span>User-wise data</span>
            </div>

            <div>
              <strong>Ready</strong>
              <span>Google Drive backup</span>
            </div>
          </div>
        </section>

        <section className="mh-auth-card">
          <div className="mh-auth-mobile-brand">
            <img
              src={mazaHishobLogo}
              alt="Maza Hishob"
            />

            <div>
              <strong>Maza Hishob</strong>
              <span>Plan · Track · Grow</span>
            </div>
          </div>

          <div className="mh-auth-card-head">
            <span>WELCOME</span>
            <h2>Sign in to Maza Hishob</h2>
            <p>
              Continue with your Google account to access
              your personal financial data.
            </p>
          </div>

          {authError && (
            <div className="mh-auth-error">
              {authError}
            </div>
          )}

          <button
            type="button"
            className="mh-google-btn"
            onClick={handleGoogleLogin}
            disabled={authSaving}
          >
            <span className="mh-google-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M21.35 12.18c0-.64-.06-1.25-.16-1.84H12v3.48h5.25a4.49 4.49 0 0 1-1.95 2.94v2.26h3.16c1.85-1.7 2.89-4.21 2.89-6.84Z"
                />
                <path
                  fill="#34A853"
                  d="M12 21.72c2.64 0 4.86-.88 6.48-2.38l-3.16-2.26c-.88.59-2 .94-3.32.94-2.55 0-4.71-1.72-5.48-4.04H3.26v2.33A9.79 9.79 0 0 0 12 21.72Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.52 13.98A5.9 5.9 0 0 1 6.2 12c0-.69.12-1.35.32-1.98V7.69H3.26A9.79 9.79 0 0 0 2.22 12c0 1.57.38 3.06 1.04 4.31l3.26-2.33Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.98c1.44 0 2.72.49 3.73 1.46l2.8-2.8C16.85 3.08 14.64 2.22 12 2.22a9.79 9.79 0 0 0-8.74 5.47l3.26 2.33C7.29 7.7 9.45 5.98 12 5.98Z"
                />
              </svg>
            </span>

            <span>
              {authSaving
                ? "Opening Google..."
                : "Continue with Google"}
            </span>

            <span className="mh-google-arrow">→</span>
          </button>

          <div className="mh-auth-trust">
            <div className="mh-auth-lock">✓</div>
            <p>
              Your Google password is never received or stored by
              Maza Hishob. Authentication is handled by Google
              and Supabase. Inactive sessions sign out automatically.
            </p>
          </div>

          <button
            type="button"
            className="mh-legacy-toggle"
            onClick={() => {
              setAuthError("");
              setShowLegacyLogin((value) => !value);
            }}
          >
            {showLegacyLogin
              ? "Hide legacy login"
              : "Use old username login"}
          </button>

          {showLegacyLogin && (
            <form
              className="mh-legacy-form"
              onSubmit={handleLogin}
            >
              <div className="form-group">
                <label>Username</label>
                <input
                  className="form-input"
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  placeholder="Old Maza Hishob username"
                  autoComplete="username"
                  disabled={authSaving}
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="login-password-wrap">
                  <input
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Password"
                    autoComplete="current-password"
                    disabled={authSaving}
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                    disabled={authSaving}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="mh-legacy-submit"
                disabled={authSaving}
              >
                {authSaving
                  ? "Signing in..."
                  : "Legacy Login"}
              </button>
            </form>
          )}

          <div className="mh-auth-footer">
            <strong>© 2026 Maza Hishob. All Rights Reserved.</strong>
            <span>Money Tracker & Personal Finance Manager</span>
          </div>
        </section>
      </main>
    </div>
  );
}

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
        <button
          type="button"
          className="brand brand-home-btn"
          onClick={() => {
            navigateTo("home");
            setProfileMenuOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="Go to Home"
          title="Home"
        >
          <img
            className="brand-logo"
            src={mazaHishobLogo}
            alt="Maza Hishob"
          />

          <div className="brand-text">
            <h1>Maza Hishob</h1>
            <p>
              Money Tracker & Personal Finance Manager
            </p>
          </div>
        </button>

        <div className="header-actions">
          <button
            type="button"
            className="icon-btn premium-alert-btn"
            title="Alerts"
            aria-label="Alerts"
            onClick={() =>
              alert("No new alerts.")
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 21h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="premium-alert-dot" />
          </button>

          <div className="account-menu-wrap">
            <button
              type="button"
              className={`account-menu-trigger ${
                profileMenuOpen ? "open" : ""
              }`}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              onClick={() => {
                setProfileMessage("");
                setProfileMenuOpen((value) => !value);
              }}
            >
              <span className="account-avatar">
                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    alt="Profile"
                  />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Zm7 7.8a7 7 0 0 0-14 0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>

              <span className="account-trigger-copy">
                <strong>{getProfileDisplayName()}</strong>
                <small>My Account</small>
              </span>

              <span className="account-chevron">⌄</span>
            </button>

            {profileMenuOpen && (
              <>
                <button
                  type="button"
                  className="account-menu-backdrop"
                  aria-label="Close account menu"
                  onClick={() => setProfileMenuOpen(false)}
                />

                <div
                  className="account-menu-panel"
                  role="menu"
                >
                  <div className="account-menu-head">
                    <div className="account-menu-avatar-large">
                      {profilePhotoUrl ? (
                        <img
                          src={profilePhotoUrl}
                          alt="Profile"
                        />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Zm7 7.8a7 7 0 0 0-14 0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>

                    <div className="account-menu-identity">
                      <strong>{getProfileDisplayName()}</strong>
                      <span>{session?.user?.email || "Signed in"}</span>
                    </div>
                  </div>

                  <div
                    className={`account-menu-status-row ${
                      driveConnected ? "connected" : "disconnected"
                    }`}
                  >
                    <span
                      className={`account-status-dot ${
                        driveConnected ? "connected" : "disconnected"
                      }`}
                    />

                    <div className="account-drive-status-copy">
                      <strong>Google Drive Backup</strong>
                      <span>
                        {driveConnected
                          ? "Connected by you"
                          : "Drive disconnected · Optional"}
                      </span>
                    </div>

                    {driveConnected ? (
                      <button
                        type="button"
                        className="account-drive-action disconnect"
                        onClick={disconnectGoogleDrive}
                        disabled={driveBusy}
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="account-drive-action connect"
                        onClick={connectGoogleDrive}
                        disabled={driveBusy}
                      >
                        {driveBusy ? "Connecting..." : "Connect"}
                      </button>
                    )}
                  </div>

                  <div className="account-photo-actions">
                    <label
                      className={`account-photo-btn ${
                        profilePhotoBusy ? "disabled" : ""
                      }`}
                    >
                      {profilePhotoBusy
                        ? "Working..."
                        : profilePhotoUrl
                        ? "Replace Photo"
                        : "Upload Profile Photo"}

                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={uploadProfilePhoto}
                        disabled={profilePhotoBusy}
                      />
                    </label>

                    {profilePhotoUrl && (
                      <button
                        type="button"
                        className="account-photo-remove"
                        onClick={removeProfilePhoto}
                        disabled={profilePhotoBusy}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <p className="account-privacy-note">
                    Your Google profile photo is not imported automatically.
                    A photo appears here only if you upload one yourself.
                  </p>

                  {profileMessage && (
                    <div className="account-profile-message">
                      {profileMessage}
                    </div>
                  )}

                  <div className="account-menu-divider" />

                  <button
                    type="button"
                    className="account-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigateTo("settings");
                    }}
                  >
                    <span>⚙</span>
                    <div>
                      <strong>Settings</strong>
                      <small>Backup, restore and preferences</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="account-menu-item signout"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <span>⇥</span>
                    <div>
                      <strong>Sign Out</strong>
                      <small>End this Maza Hishob session</small>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
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
                    navigateTo(key)
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
                navigateTo(
                  "settings"
                )
              }
            >
              <span className="side-icon">
                ⚙
              </span>

              <span className="desktop-nav-label">Settings</span>
              <span className="mobile-nav-label">More</span>
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
            <button
  className="side-item logout-item"
  onClick={handleLogout}
>
  <span className="side-icon">
    ⇥
  </span>

  <span>Logout</span>
</button>
          </div>
        </aside>

        <main className="main-content">
          {activePage === "home" && (
            <div className="locked-home-dashboard">
              <section className="locked-summary-section locked-lifetime-summary">
                <div className="locked-summary-toolbar">
                  <div className="locked-summary-copy">
                    <span>TOTAL SUMMARY</span>
                    <h3>From Start to Today</h3>
                    <p>{lifetimeDateLabel}</p>
                  </div>

                  <button
                    type="button"
                    className="locked-summary-eye"
                    onClick={() =>
                      setLifetimeAmountsVisible((current) => !current)
                    }
                    aria-label={
                      lifetimeAmountsVisible
                        ? "Hide total amounts"
                        : "Show total amounts"
                    }
                    title={
                      lifetimeAmountsVisible
                        ? "Hide total amounts"
                        : "Show total amounts"
                    }
                  >
                    <PrivacyIcon visible={lifetimeAmountsVisible} />
                  </button>
                </div>

                <div className="locked-kpi-grid">
                  <button
                    type="button"
                    className="locked-kpi-card income"
                    onClick={() => navigateTo("income")}
                  >
                    <span className="locked-kpi-icon">
                      <DashboardIcon type="income" />
                    </span>
                    <span>Total Income</span>
                    <strong>{lifetimePrivateMoney(lifetimeIncomeTotal)}</strong>
                    <small>Start date to today</small>
                  </button>

                  <button
                    type="button"
                    className="locked-kpi-card expense"
                    onClick={() => openExpense()}
                  >
                    <span className="locked-kpi-icon">
                      <DashboardIcon type="expense" />
                    </span>
                    <span>Total Expenses</span>
                    <strong>{lifetimePrivateMoney(lifetimeExpenseTotal)}</strong>
                    <small>Start date to today</small>
                  </button>

                  <button
                    type="button"
                    className="locked-kpi-card savings"
                    onClick={() => navigateTo("reports")}
                  >
                    <span className="locked-kpi-icon">◆</span>
                    <span>Total Savings</span>
                    <strong>{lifetimePrivateMoney(lifetimeSavings)}</strong>
                    <small>Income minus expenses</small>
                  </button>

                  <article className="locked-kpi-card balance">
                    <span className="locked-kpi-icon">₹</span>
                    <span className="locked-balance-title">Total Balance</span>
                    <strong>{lifetimePrivateMoney(lifetimeBalance)}</strong>
                    <small>Available overall balance</small>

                    <div className="locked-safe-blend" aria-hidden="true">
                      <img src={dashboardSafe} alt="" />
                    </div>
                  </article>
                </div>
              </section>

              <section className="locked-summary-section locked-monthly-summary">
                <div className="locked-summary-toolbar locked-monthly-toolbar">
                  <div className="locked-summary-copy">
                    <span>MONTHLY SUMMARY</span>
                    <h3>{dashboardMonthLabel}</h3>
                    <p>Select month and year to view monthly calculations</p>
                  </div>

                  <div className="locked-month-controls">
                    <label>
                      <span>Month</span>
                      <select
                        value={String(month).slice(5, 7)}
                        onChange={(e) => {
                          const selectedYear =
                            String(month).slice(0, 4) || String(new Date().getFullYear());
                          setMonth(`${selectedYear}-${e.target.value}`);
                          setPeriodType("monthly");
                        }}
                        aria-label="Select dashboard month"
                      >
                        {dashboardMonths.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Year</span>
                      <select
                        value={String(month).slice(0, 4)}
                        onChange={(e) => {
                          const selectedMonth = String(month).slice(5, 7) || "01";
                          setMonth(`${e.target.value}-${selectedMonth}`);
                          setPeriodType("monthly");
                        }}
                        aria-label="Select dashboard year"
                      >
                        {dashboardYears.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="locked-summary-eye"
                      onClick={() => setAmountsVisible((current) => !current)}
                      aria-label={
                        amountsVisible
                          ? "Hide monthly amounts"
                          : "Show monthly amounts"
                      }
                      title={
                        amountsVisible
                          ? "Hide monthly amounts"
                          : "Show monthly amounts"
                      }
                    >
                      <PrivacyIcon visible={amountsVisible} />
                    </button>
                  </div>
                </div>

                <div className="locked-kpi-grid locked-monthly-kpi-grid">
                  <button
                    type="button"
                    className="locked-kpi-card income"
                    onClick={() => navigateTo("income")}
                  >
                    <span className="locked-kpi-icon">
                      <DashboardIcon type="income" />
                    </span>
                    <span>Monthly Income</span>
                    <strong>{privateMoney(dashboardMonthIncomeTotal)}</strong>
                    <small>{dashboardMonthLabel}</small>
                  </button>

                  <button
                    type="button"
                    className="locked-kpi-card expense"
                    onClick={() => openExpense()}
                  >
                    <span className="locked-kpi-icon">
                      <DashboardIcon type="expense" />
                    </span>
                    <span>Monthly Expenses</span>
                    <strong>{privateMoney(dashboardMonthExpenseTotal)}</strong>
                    <small>{dashboardMonthLabel}</small>
                  </button>

                  <button
                    type="button"
                    className="locked-kpi-card savings"
                    onClick={() => navigateTo("reports")}
                  >
                    <span className="locked-kpi-icon">◆</span>
                    <span>Monthly Savings</span>
                    <strong>{privateMoney(dashboardMonthSavings)}</strong>
                    <small>Income minus expenses</small>
                  </button>

                  <article className="locked-kpi-card balance monthly-balance">
                    <span className="locked-kpi-icon">₹</span>
                    <span className="locked-balance-title">Monthly Balance</span>
                    <strong>{privateMoney(dashboardMonthSavings)}</strong>
                    <small>{dashboardMonthLabel}</small>
                  </article>
                </div>
              </section>

              <section className="locked-dashboard-card locked-quick-card">
                <div className="locked-section-title">
                  <h3>QUICK ACTIONS</h3>
                </div>

                <div className="locked-quick-grid">
                  <button type="button" onClick={openExpenseLedgerFromDashboard}>
                    <span><DashboardIcon type="expense" /></span>
                    <strong>Add Expense</strong>
                  </button>

                  <button type="button" onClick={openExpenseLedgerFromDashboard}>
                    <span><DashboardIcon type="income" /></span>
                    <strong>Add Income</strong>
                  </button>

                  <button type="button" onClick={() => openLoan()}>
                    <span><DashboardIcon type="loan" /></span>
                    <strong>Add Loan</strong>
                  </button>

                  <button type="button" onClick={() => navigateTo("loans")}>
                    <span><DashboardIcon type="emi" /></span>
                    <strong>EMI Paid</strong>
                  </button>

                  <button type="button" onClick={() => navigateTo("reports")}>
                    <span><DashboardIcon type="reports" /></span>
                    <strong>Reports</strong>
                  </button>

                  <button type="button" onClick={() => navigateTo("settings")}>
                    <span>☁</span>
                    <strong>Backup</strong>
                  </button>
                </div>
              </section>

              <section className="locked-content-grid">
                <article className="locked-dashboard-card locked-breakdown-card">
                  <div className="locked-section-title locked-title-row">
                    <h3>EXPENSE BREAKDOWN</h3>
                    <span>{dashboardMonthLabel}</span>
                  </div>

                  {dashboardCategoryTotals.length ? (
                    <div className="locked-breakdown-layout">
                      <div
                        className="locked-donut"
                        style={{
                          background: `conic-gradient(${dashboardDonutStops})`,
                        }}
                      >
                        <div className="locked-donut-center">
                          <span>Total Expense</span>
                          <strong>{privateMoney(dashboardExpenseTotal)}</strong>
                        </div>
                      </div>

                      <div className="locked-breakdown-legend">
                        {dashboardCategoryTotals.slice(0, 6).map((item, index) => {
                          const pct =
                            dashboardExpenseTotal > 0
                              ? (Number(item.amount || 0) /
                                  dashboardExpenseTotal) *
                                100
                              : 0;

                          return (
                            <div
                              className="locked-breakdown-row"
                              key={`locked-breakdown-${item.category}`}
                            >
                              <i
                                style={{
                                  background:
                                    dashboardCategoryColors[
                                      index % dashboardCategoryColors.length
                                    ],
                                }}
                              />
                              <div>
                                <strong>{item.category}</strong>
                                <span>
                                  {privateMoney(item.amount)} ({pct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="locked-empty-state">
                      No expenses for {dashboardMonthLabel}.
                    </div>
                  )}

                  <button
                    type="button"
                    className="locked-link-button"
                    onClick={() => navigateTo("expenses")}
                  >
                    View All Expenses →
                  </button>
                </article>

                <div className="locked-side-stack">
                  <article className="locked-dashboard-card locked-emi-card">
                    <div className="locked-section-title">
                      <h3>UPCOMING EMI</h3>
                    </div>

                    {upcomingLoan ? (
                      <div className="locked-upcoming-emi">
                        <span className="locked-emi-icon">
                          <DashboardIcon type="bank" />
                        </span>
                        <div className="locked-emi-name">
                          <strong>{upcomingLoan.loanName}</strong>
                          <span>{upcomingLoan.lender || upcomingLoan.loanType}</span>
                        </div>
                        <div className="locked-emi-meta">
                          <span>EMI Amount</span>
                          <strong>{privateMoney(upcomingLoan.emi)}</strong>
                        </div>
                        <div className="locked-emi-meta">
                          <span>Due Date</span>
                          <strong>{upcomingLoan.nextEmiDate || "—"}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="locked-empty-state">
                        No upcoming EMI.
                      </div>
                    )}

                    <button
                      type="button"
                      className="locked-link-button"
                      onClick={() => navigateTo("loans")}
                    >
                      View All EMIs →
                    </button>
                  </article>

                  <article className="locked-dashboard-card locked-recent-card">
                    <div className="locked-section-title locked-title-row">
                      <h3>RECENT EXPENSES</h3>
                      <button
                        type="button"
                        onClick={() => navigateTo("expenses")}
                      >
                        View All →
                      </button>
                    </div>

                    <div className="locked-recent-list">
                      {transactions
                        .filter((item) => item.type === "expense")
                        .slice(0, 5)
                        .map((item) => (
                          <div
                            className="locked-recent-row"
                            key={`locked-recent-${item.id}`}
                          >
                            <span
                              className={`locked-recent-icon expense-category-${getExpenseCategoryKey(
                                item.title
                              )}`}
                            >
                              <DashboardIcon
                                type={getExpenseCategoryIconType(item.title)}
                              />
                            </span>

                            <div>
                              <strong>{item.title}</strong>
                              <span>{item.paymentMode}</span>
                            </div>

                            <b>- {privateMoney(item.amount)}</b>
                            <small>{item.date}</small>
                          </div>
                        ))}
                    </div>
                  </article>
                </div>
              </section>

              <section className="locked-dashboard-card locked-loan-summary">
                <div className="locked-section-title">
                  <h3>LOAN SUMMARY</h3>
                </div>

                <div className="locked-loan-summary-grid">
                  <div>
                    <span>Total Loans</span>
                    <strong>{loans.length}</strong>
                  </div>
                  <div>
                    <span>Total Outstanding</span>
                    <strong>
                      {privateMoney(
                        loans.reduce(
                          (sum, loan) =>
                            sum + Number(loan.outstanding || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Total EMI / Month</span>
                    <strong>
                      {privateMoney(
                        loans.reduce(
                          (sum, loan) => sum + Number(loan.emi || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Interest Paid</span>
                    <strong>
                      {privateMoney(
                        emiPayments.reduce(
                          (sum, item) =>
                            sum + Number(item.interestPaid || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Principal Paid</span>
                    <strong>
                      {privateMoney(
                        emiPayments.reduce(
                          (sum, item) =>
                            sum + Number(item.principalPaid || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo("loans")}
                  >
                    View Loans →
                  </button>
                </div>
              </section>
            </div>
          )}

          {activePage === "income" && (
            <>
              <PageHead
                eyebrow="INCOME MANAGEMENT"
                title="Income History"
                text="Track and manage every income entry"
                action="＋ Add Income"
                onAction={() => openIncome()}
              />

              <div className="stats-row">
                <Stat
                  label="All Income"
                  value={money(totalIncome)}
                  note={`${incomes.length} transactions`}
                />

                <Stat
                  label={`${monthLabel} Income`}
                  value={money(monthIncomeTotal)}
                  note={`${monthIncomes.length} transactions`}
                />

                <Stat
                  label="Average Income"
                  value={money(
                    incomes.length ? totalIncome / incomes.length : 0
                  )}
                  note="Per transaction"
                />
              </div>

              <div className="filter-bar">
                <input
                  className="form-input"
                  placeholder="🔎 Search source or note..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  className="form-input"
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                >
                  <option value="All">All Payment Modes</option>
                  {paymentModes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  className="form-input"
                  value={periodType}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPeriodType(next);
                    if (next === "yearly") {
                      setFilterYear(month.split("-")[0] || String(new Date().getFullYear()));
                    }
                  }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom Range</option>
                  <option value="all">All</option>
                </select>

                {periodType === "monthly" && (
                  <input
                    className="form-input"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                )}

                {periodType === "yearly" && (
                  <select
                    className="form-input"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                  >
                    {Array.from(
                      { length: 2099 - 2024 + 1 },
                      (_, i) => 2024 + i
                    ).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}

                {periodType === "custom" && (
                  <>
                    <input
                      className="form-input"
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      title="From date"
                    />
                    <input
                      className="form-input"
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => setCustomTo(e.target.value)}
                      title="To date"
                    />
                  </>
                )}

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setSearch("");
                    setFilterMode("All");
                    setPeriodType("monthly");
                    setMonth(getMonthKey(getToday()));
                    setFilterYear(String(new Date().getFullYear()));
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                >
                  Clear Filters
                </button>
              </div>

              <div className="transaction-list">
                {filteredIncomes.length ? (
                  filteredIncomes.map((x) => (
                    <div className="transaction-item" key={x.id}>
                      <div className="transaction-icon">↗</div>

                      <div className="transaction-details">
                        <strong>{x.source}</strong>
                        <span>{x.note || x.paymentMode}</span>
                      </div>

                      <div className="transaction-right">
                        <strong>+ {money(x.amount)}</strong>
                        <span>{x.date}</span>
                      </div>

                      <button
                        type="button"
                        className="mini-btn"
                        title="Edit income"
                        onClick={() => openIncome(x)}
                      >
                        ✎
                      </button>

                      <button
                        type="button"
                        className="delete-expense"
                        title="Delete income"
                        onClick={() => deleteIncome(x.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-transactions">
                    <div className="empty-icon">◇</div>
                    <h4>No matching income</h4>
                    <p>Add income or change the selected filters.</p>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => openIncome()}
                    >
                      ＋ Add Income
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {activePage === "expenses" && (
            <section
              className={`daily-ledger-page ${
                ledgerComposerOpen ? "ledger-composer-is-open" : ""
              }`}
            >
              <PageHead
                eyebrow="MONEY JOURNAL"
                title="Day to Day Expenses"
                text="Your income, spending and running balance in one place"
              />

              <div className="ledger-tabs" role="tablist" aria-label="Expense period">
                <button
                  type="button"
                  className="ledger-pencil-tab"
                  aria-label="Open quick entry"
                  title="Quick entry"
                  onClick={() => {
                    setExpenseLedgerView("daily");
                    openLedgerComposer("expense");
                  }}
                >
                  ✎
                </button>

                {[
                  ["daily", "Daily"],
                  ["monthly", "Monthly"],
                  ["yearly", "Yearly"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={expenseLedgerView === value}
                    className={expenseLedgerView === value ? "active" : ""}
                    onClick={() => {
                      setExpenseLedgerView(value);
                      setLedgerPeriodPicker(null);
                      if (value !== "daily") setLedgerComposerOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {expenseLedgerView === "daily" ? (
                <>
                  <div className="ledger-overview-period ledger-daily-period">
                    <button
                      type="button"
                      className="ledger-period-arrow"
                      aria-label="Previous day"
                      onClick={() => shiftExpenseLedgerPeriod(-1)}
                    >
                      ‹
                    </button>

                    <div className="ledger-overview-selectors daily">
                      <label
                        className="ledger-overview-select-control ledger-date-select-control"
                        title="Select date"
                      >
                        <span>Date</span>
                        <strong>{String(ledgerDayNumber).padStart(2, "0")}</strong>
                        <b aria-hidden="true">⌄</b>
                        <input
                          className="ledger-native-date-input"
                          type="date"
                          value={expenseLedgerDate}
                          onChange={(e) =>
                            setExpenseLedgerDate(e.target.value || getToday())
                          }
                          aria-label={`Select date, currently ${expenseLedgerDate}`}
                        />
                      </label>

                      <button
                        type="button"
                        className="ledger-overview-select-control ledger-month-select-control"
                        onClick={() => openLedgerPeriodPicker("month")}
                        aria-label={`Select month, currently ${ledgerSelectedMonthLabel}`}
                      >
                        <span>Month</span>
                        <strong>{ledgerSelectedMonthLabel}</strong>
                        <b aria-hidden="true">⌄</b>
                      </button>

                      <button
                        type="button"
                        className="ledger-overview-select-control ledger-year-select-control"
                        onClick={() => openLedgerPeriodPicker("year")}
                        aria-label={`Select year, currently ${ledgerSelectedYear}`}
                      >
                        <span>Year</span>
                        <strong>{ledgerSelectedYear}</strong>
                        <b aria-hidden="true">⌄</b>
                      </button>

                      <div className="ledger-daily-period-meta">
                        <span>{ledgerWeekday}</span>
                        <small>Daily Overview</small>
                        <strong>
                          <span>Balance</span>
                          {privateMoney(expenseLedgerData.balance)}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="ledger-period-arrow"
                      aria-label="Next day"
                      onClick={() => shiftExpenseLedgerPeriod(1)}
                    >
                      ›
                    </button>
                  </div>

                  <div className="ledger-carry-forward">
                    <span>C/F</span>
                    <strong>{privateMoney(expenseLedgerData.carryForward)}</strong>
                  </div>

                  <div className="ledger-section ledger-credit">
                    <div className="ledger-section-head">
                      <div><span className="ledger-dot" />Income (Credit)</div>
                      <strong>{privateMoney(expenseLedgerData.credit)}</strong>
                    </div>
                    <div className="ledger-items">
                      {expenseLedgerData.incomes.length ? (
                        expenseLedgerData.incomes.map((item) => (
                          <div className="ledger-item" key={item.id}>
                            <div>
                              <strong>{item.source}</strong>
                              <span>{item.note || item.paymentMode} · {item.date}</span>
                            </div>
                            <strong className="credit-amount">
                              + {privateMoney(item.amount)}
                            </strong>
                            <button
                              type="button"
                              className="mini-btn"
                              aria-label={`Edit ${item.source}`}
                              onClick={() => openIncome(item)}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="delete-expense"
                              aria-label={`Delete ${item.source}`}
                              onClick={() => deleteIncome(item.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <button
                          type="button"
                          className="ledger-empty ledger-empty-action"
                          onClick={() => openLedgerComposer("income")}
                        >
                          Tap on <b>＋</b> to add a new income entry.
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="ledger-section ledger-debit">
                    <div className="ledger-section-head">
                      <div><span className="ledger-dot" />Expense (Debit)</div>
                      <strong>{privateMoney(expenseLedgerData.debit)}</strong>
                    </div>
                    <div className="ledger-items">
                      {expenseLedgerData.expenses.length ? (
                        expenseLedgerData.expenses.map((item) => (
                          <div className="ledger-item" key={item.id}>
                            <div>
                              <strong>{item.note || item.category}</strong>
                              <span>{item.category} · {item.paymentMode} · {item.date}</span>
                            </div>
                            <strong className="debit-amount">
                              - {privateMoney(item.amount)}
                            </strong>
                            <button
                              type="button"
                              className="mini-btn"
                              aria-label={`Edit ${item.note || item.category}`}
                              onClick={() => openExpense(item)}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="delete-expense"
                              aria-label={`Delete ${item.note || item.category}`}
                              onClick={() => deleteExpense(item.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <button
                          type="button"
                          className="ledger-empty ledger-empty-action"
                          onClick={() => openLedgerComposer("expense")}
                        >
                          Tap on <b>＋</b> to add a new expense entry.
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="ledger-overview-period">
                    <button
                      type="button"
                      className="ledger-period-arrow"
                      aria-label={`Previous ${expenseLedgerView}`}
                      onClick={() => shiftExpenseLedgerPeriod(-1)}
                    >
                      ‹
                    </button>

                    <div
                      className={`ledger-overview-selectors ${expenseLedgerView}`}
                    >
                      {expenseLedgerView === "monthly" && (
                        <button
                          type="button"
                          className="ledger-overview-select-control"
                          onClick={() => openLedgerPeriodPicker("month")}
                          aria-label={`Select month, currently ${ledgerSelectedMonthLabel}`}
                        >
                          <span>Month</span>
                          <strong>{ledgerSelectedMonthLabel}</strong>
                          <b aria-hidden="true">⌄</b>
                        </button>
                      )}

                      <button
                        type="button"
                        className="ledger-overview-select-control"
                        onClick={() => openLedgerPeriodPicker("year")}
                        aria-label={`Select year, currently ${ledgerSelectedYear}`}
                      >
                        <span>Year</span>
                        <strong>{ledgerSelectedYear}</strong>
                        <b aria-hidden="true">⌄</b>
                      </button>

                      <small>
                        {expenseLedgerView === "monthly"
                          ? "Monthly Overview"
                          : "Yearly Overview"}
                      </small>
                    </div>

                    <button
                      type="button"
                      className="ledger-period-arrow"
                      aria-label={`Next ${expenseLedgerView}`}
                      onClick={() => shiftExpenseLedgerPeriod(1)}
                    >
                      ›
                    </button>
                  </div>

                  <div
                    className={`ledger-overview-summary ledger-sticky-summary ${expenseLedgerView}`}
                    aria-label={`${expenseLedgerView} totals`}
                  >
                    <div className="ledger-summary-cell credit">
                      <span>Total Income (Credit)</span>
                      <strong>{privateMoney(expenseLedgerData.credit)}</strong>
                    </div>
                    <div className="ledger-summary-cell debit">
                      <span>Total Expense (Debit)</span>
                      <strong>{privateMoney(expenseLedgerData.debit)}</strong>
                    </div>
                    <div className="ledger-summary-cell carry">
                      <span>C/F</span>
                      <strong>{privateMoney(expenseLedgerData.carryForward)}</strong>
                    </div>
                    <div className="ledger-summary-cell balance">
                      <span>Balance</span>
                      <strong>{privateMoney(expenseLedgerData.balance)}</strong>
                    </div>
                  </div>

                  {expenseLedgerView === "yearly" ? (
                    <div className="ledger-yearly-table-wrap">
                      <table className="ledger-yearly-table">
                        <thead>
                          <tr>
                            <th>Month</th>
                            <th>Income</th>
                            <th>Expense</th>
                            <th>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearlyOverviewRows.map((row) => (
                            <tr key={row.monthValue}>
                              <th scope="row">{row.monthLabel}</th>
                              <td className="credit-amount">
                                {privateMoney(row.income)}
                              </td>
                              <td className="debit-amount">
                                {privateMoney(row.expense)}
                              </td>
                              <td
                                className={
                                  row.balance < 0 ? "debit-amount" : "balance-amount"
                                }
                              >
                                {privateMoney(row.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th scope="row">Year Total</th>
                            <td>{privateMoney(yearlyOverviewTotal.income)}</td>
                            <td>{privateMoney(yearlyOverviewTotal.expense)}</td>
                            <td>{privateMoney(yearlyOverviewTotal.balance)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <>
                      <div className="ledger-monthly-days">
                        {monthlyLedgerDayGroups.length ? (
                          monthlyLedgerDayGroups.map((group) => (
                            <article className="ledger-month-day-card" key={group.date}>
                              <header>
                                <strong>{formatLedgerDayHeading(group.date)}</strong>
                              </header>

                              <div className="ledger-month-day-columns">
                                <section className="credit">
                                  <h4>
                                    <span>Income (Credit)</span>
                                    <strong>{privateMoney(group.incomeTotal)}</strong>
                                  </h4>

                                  {group.incomes.length ? (
                                    group.incomes.map((entry) => (
                                      <div className="ledger-month-entry" key={entry.key}>
                                        <span>
                                          <strong>{entry.entryName}</strong>
                                          <small>
                                            {entry.category} · {entry.paymentMode}
                                          </small>
                                        </span>
                                        <b>+ {privateMoney(entry.amount)}</b>
                                      </div>
                                    ))
                                  ) : (
                                    <p>No income</p>
                                  )}
                                </section>

                                <section className="debit">
                                  <h4>
                                    <span>Expense (Debit)</span>
                                    <strong>{privateMoney(group.expenseTotal)}</strong>
                                  </h4>

                                  {group.expenses.length ? (
                                    group.expenses.map((entry) => (
                                      <div className="ledger-month-entry" key={entry.key}>
                                        <span>
                                          <strong>{entry.entryName}</strong>
                                          <small>
                                            {entry.category} · {entry.paymentMode}
                                          </small>
                                        </span>
                                        <b>- {privateMoney(entry.amount)}</b>
                                      </div>
                                    ))
                                  ) : (
                                    <p>No expense</p>
                                  )}
                                </section>
                              </div>

                              <footer>
                                <span>Balance</span>
                                <strong className={group.balance < 0 ? "negative" : ""}>
                                  {privateMoney(group.balance)}
                                </strong>
                              </footer>
                            </article>
                          ))
                        ) : (
                          <div className="ledger-monthly-empty">
                            No income or expense entries for {ledgerMonthYearLabel}.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <section className="ledger-print-statement">
                    <header className="ledger-print-header">
                      <div>
                        <span>MAZA HISHOB</span>
                        <h1>
                          {expenseLedgerView === "monthly" ? "Monthly" : "Yearly"}
                          {" "}Expense Statement
                        </h1>
                      </div>
                      <p>
                        <strong>Period:</strong> {ledgerStatementPeriodLabel}
                      </p>
                    </header>

                    <div className="ledger-print-summary">
                      <div>
                        <span>Carry Forward</span>
                        <strong>{money(expenseLedgerData.carryForward)}</strong>
                      </div>
                      <div>
                        <span>Total Income</span>
                        <strong>{money(expenseLedgerData.credit)}</strong>
                      </div>
                      <div>
                        <span>Total Expense</span>
                        <strong>{money(expenseLedgerData.debit)}</strong>
                      </div>
                      <div>
                        <span>Closing Balance</span>
                        <strong>{money(expenseLedgerData.balance)}</strong>
                      </div>
                    </div>

                    <table className="ledger-print-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Entry Name / Description</th>
                          <th>Category / Source</th>
                          <th>Payment Mode</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerStatementEntries.map((entry) => (
                          <tr key={`print-${entry.key}`}>
                            <td>{formatLedgerPrintDate(entry.date)}</td>
                            <td>{entry.type}</td>
                            <td>{entry.entryName}</td>
                            <td>{entry.category}</td>
                            <td>{entry.paymentMode}</td>
                            <td className={entry.type === "Income" ? "credit" : "debit"}>
                              {entry.type === "Income" ? "+ " : "- "}
                              {money(entry.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <footer className="ledger-print-footer">
                      <span>{ledgerStatementEntries.length} individual entries</span>
                      <span>Generated {new Date().toLocaleString("en-IN")}</span>
                    </footer>
                  </section>
                </>
              )}

              {!ledgerComposerOpen && (
                <button
                  type="button"
                  className={`ledger-floating-action ${
                    expenseLedgerView === "daily" ? "add" : "pdf"
                  }`}
                  aria-label={
                    expenseLedgerView === "daily"
                      ? "Add ledger entry"
                      : "Save or share report as PDF"
                  }
                  title={
                    expenseLedgerView === "daily"
                      ? "Add entry"
                      : "Save / Share PDF"
                  }
                  onClick={() => {
                    if (expenseLedgerView === "daily") {
                      openLedgerComposer("expense");
                    } else {
                      exportExpenseLedgerPdf();
                    }
                  }}
                >
                  {expenseLedgerView === "daily" ? (
                    "+"
                  ) : (
                    <><span>▣</span><small>PDF</small></>
                  )}
                </button>
              )}

              {ledgerComposerOpen && expenseLedgerView === "daily" && (
                <aside
                  className="ledger-quick-composer"
                  aria-label="Quick income or expense entry"
                >
                  <button
                    type="button"
                    className="ledger-composer-collapse"
                    aria-label="Close quick entry"
                    onClick={() => setLedgerComposerOpen(false)}
                  >
                   ⌄
                  </button>

                  <div className="ledger-entry-switch" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={ledgerEntryType === "income"}
                      className={ledgerEntryType === "income" ? "active" : ""}
                      onClick={() => changeLedgerEntryType("income")}
                    >
                      {ledgerEntryType === "income" && <span>✓</span>}
                      Income (Credit)
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={ledgerEntryType === "expense"}
                      className={ledgerEntryType === "expense" ? "active" : ""}
                      onClick={() => changeLedgerEntryType("expense")}
                    >
                      {ledgerEntryType === "expense" && <span>✓</span>}
                      Expense (Debit)
                    </button>
                  </div>

                  <form onSubmit={saveLedgerQuickEntry}>
                    <div className="ledger-quick-main-row">
                      <label className="ledger-quick-field ledger-quick-name">
                        <span>
                          {ledgerEntryType === "expense" ? "Category" : "Income Source"}
                        </span>
                        <select
                          value={ledgerQuickForm.name}
                          onChange={(e) =>
                            setLedgerQuickForm((current) => ({
                              ...current,
                              name: e.target.value,
                            }))
                          }
                        >
                          {(ledgerEntryType === "expense" ? categories : incomeSources).map(
                            (item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      <label className="ledger-quick-field ledger-quick-amount">
                        <span>Amount</span>
                        <div>
                          <b>₹</b>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={ledgerQuickForm.amount}
                            onChange={(e) =>
                              setLedgerQuickForm((current) => ({
                                ...current,
                                amount: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </label>

                      <button
                        type="submit"
                        className="ledger-quick-save"
                        disabled={saving}
                        aria-label="Save entry"
                      >
                        {saving ? "…" : "✓"}
                      </button>
                    </div>

                    <div className="ledger-quick-detail-row">
                      <div className="ledger-quick-description">
                        <span aria-hidden="true">✎</span>
                        <input
                          type="text"
                          value={ledgerQuickForm.description}
                          onChange={(e) => {
                            setLedgerQuickForm((current) => ({
                              ...current,
                              description: e.target.value,
                            }));
                            setLedgerSuggestionOpen(true);
                          }}
                          onFocus={() => setLedgerSuggestionOpen(true)}
                          onBlur={() => {
                            window.setTimeout(() => setLedgerSuggestionOpen(false), 140);
                          }}
                          placeholder="Description"
                          autoComplete="off"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={
                            ledgerSuggestionOpen && matchingLedgerSuggestions.length > 0
                          }
                          aria-controls="ledger-quick-suggestion-list"
                        />

                        {ledgerSuggestionOpen && matchingLedgerSuggestions.length > 0 && (
                          <div
                            id="ledger-quick-suggestion-list"
                            className="expense-suggestion-menu ledger-quick-suggestions"
                            role="listbox"
                            aria-label="Previous entry suggestions"
                          >
                            {matchingLedgerSuggestions.map((suggestion) => (
                              <button
                                type="button"
                                role="option"
                                className="expense-suggestion-option"
                                key={`${ledgerEntryType}-${suggestion.label}`}
                                onPointerDown={(event) => event.preventDefault()}
                                onClick={() => applyLedgerSuggestion(suggestion)}
                              >
                                <strong>{suggestion.label}</strong>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <label className="ledger-quick-mode">
                        <span>Payment Mode</span>
                        <select
                          value={ledgerQuickForm.paymentMode}
                          onChange={(e) =>
                            setLedgerQuickForm((current) => ({
                              ...current,
                              paymentMode: e.target.value,
                            }))
                          }
                        >
                          {paymentModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <small className="ledger-entry-date-note">
                      Entry date: {new Date(`${expenseLedgerDate}T00:00:00`).toLocaleDateString(
                        "en-IN",
                        { day: "2-digit", month: "short", year: "numeric" }
                      )}
                    </small>
                  </form>
                </aside>
              )}
            </section>
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
    loans
      .filter(
        (x) =>
          (x.status || "Active") !== "Closed" &&
          Number(x.outstanding ?? x.amount ?? 0) > 0
      )
      .reduce(
        (s, x) =>
          s + Number(x.emi || 0),
        0
      )
  )}
  note="Active loans EMI / month"
/>

                <Stat
                  label="Outstanding"
                  value={money(
                    loans.reduce(
                      (s, x) =>
                        s +
                        Number(
                          x.outstanding ??
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
    historicalInterestPaid + trackedInterestPaid
  )}
  note="Historical + tracked"
/>
<Stat
  label="Principal Paid"
  value={money(
    historicalPrincipalPaid + trackedPrincipalPaid
  )}
  note="Historical + tracked"
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
          0
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
    <span>Original Start</span>
    <strong>
      {loan.originalLoanStartDate || "—"}
    </strong>
  </div>
  <div>
  <span>
    Principal Paid
  </span>

  <strong>
    {money(
      Number(loan.principalPaidTillDate || 0) +
        emiPayments
          .filter(
            (p) => String(p.loanId) === String(loan.id)
          )
          .reduce(
            (s, p) => s + Number(p.principalPaid || 0),
            0
          ) +
        prepaymentPayments
          .filter(
            (p) => String(p.loanId) === String(loan.id)
          )
          .reduce(
            (s, p) => s + Number(p.amount || 0),
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
      Number(loan.interestPaidTillDate || 0) +
        emiPayments
          .filter(
            (p) => String(p.loanId) === String(loan.id)
          )
          .reduce(
            (s, p) => s + Number(p.interestPaid || 0),
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

{loan.trackingDate && (
  <div className="loan-next">
    <div>
      Tracking From: {String(loan.trackingDate).slice(0, 10)}
    </div>
  </div>
)}

{loan.nextEmiDate && (
  <div className="loan-next">
    <div>
      Next EMI:{" "}
      {String(loan.nextEmiDate).slice(0, 10)}
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
  <div className="pending-emi-card">
    <strong className="pending-emi-title">
      🔴 {getPendingEmis(loan).length} EMI Pending
    </strong>

    <div className="pending-emi-list">
      {getPendingEmis(loan).map(
        (p) => (
          <div
            key={`${p.loanId}-${p.dueDate}`}
            className="pending-emi-row"
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

        {activePage === "loans" && (
          <section className="dashboard-section">
            <div className="section-heading">
              <div>
                <span>HISTORY</span>
                <h3>Prepayment History</h3>
              </div>
            </div>

            {prepaymentPayments.length ? (
              <div className="transaction-list">
                {prepaymentPayments.map((p) => (
                  <div className="transaction-item" key={p.id}>
                    <div className="transaction-icon">₹</div>

                    <div className="transaction-details">
                      <strong>{p.loanName}</strong>
                      <span>
                        Prepayment • {p.strategy === "emi" ? "Reduce EMI" : "Reduce Tenure"}
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
                          Outstanding: <strong>{money(p.oldOutstanding)}</strong>
                          {" → "}
                          <strong>{money(p.newOutstanding)}</strong>
                        </span>
                        <span>
                          EMI: <strong>{money(p.oldEmi)}</strong>
                          {" → "}
                          <strong>{money(p.newEmi)}</strong>
                        </span>
                        <span>
                          Tenure: <strong>{p.oldTenure} months</strong>
                          {" → "}
                          <strong>{p.newTenure} months</strong>
                        </span>
                      </div>
                    </div>

                    <div className="transaction-right">
                      <strong>{money(p.amount)}</strong>
                      <span>{p.paidDate}</span>
                    </div>

                    <button
                      type="button"
                      className="delete-expense"
                      title="Delete prepayment"
                      disabled={saving}
                      onClick={() => deletePrepaymentPayment(p.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No prepayments recorded yet.</p>
            )}
          </section>
        )}

        {activePage === "reports" && (
  <>
    <PageHead
      eyebrow="INSIGHTS"
      title="Reports"
      text="Simple view of your money"
    />
    <div className="report-filters">
      <div className="filter-group">
        <label>Filter</label>
        <select
          className="form-input"
          value={periodType}
          onChange={(e) => {
            const next = e.target.value;
            setPeriodType(next);
            if (next === "yearly") {
              setFilterYear(month.split("-")[0] || String(new Date().getFullYear()));
            }
          }}
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom Range</option>
          <option value="all">All</option>
        </select>
      </div>

      {periodType === "monthly" && (
        <div className="filter-group">
          <label>Month</label>
          <input
            type="month"
            className="form-input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      )}

      {periodType === "yearly" && (
        <div className="filter-group">
          <label>Year</label>
          <select
            className="form-input"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            {Array.from(
              { length: 2099 - 2024 + 1 },
              (_, i) => 2024 + i
            ).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      )}

      {periodType === "custom" && (
        <>
          <div className="filter-group">
            <label>From Date</label>
            <input
              type="date"
              className="form-input"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>To Date</label>
            <input
              type="date"
              className="form-input"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        </>
      )}

      <div className="filter-group">
        <label>Selected Period</label>
        <strong className="filter-value">
          {monthLabel}
        </strong>
      </div>
    </div>

   
    {/* =========================
        THIS MONTH
    ========================= */}

    <div className="stats-row">
      <Stat
        label="Income"
        value={money(
          monthIncomeTotal
        )}
        note="Selected period"
      />

      <Stat
        label="Expenses"
        value={money(
          monthExpenseTotal
        )}
        note="Selected period"
      />

      <Stat
        label="Savings"
        value={money(
          monthSavings
        )}
        note="Income minus expenses"
      />
    </div>

    {/* =========================
    EXPENSE BY CATEGORY
========================= */}

<section className="report-card">
  <div className="section-heading">
    <div>
      <span>BREAKDOWN</span>

      <h3>
        Expense Categories
      </h3>
    </div>
  </div>

  {categoryTotals.length ? (
    <div className="expense-category-table-wrap">
      <table className="expense-category-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Category</th>
            <th>Amount</th>
            <th>% of Total</th>
          </tr>
        </thead>

        <tbody>
          {categoryTotals.map((x, index) => {
            const totalExpense = categoryTotals.reduce(
              (sum, item) =>
                sum + Number(item.amount || 0),
              0
            );

            const percentage =
              totalExpense > 0
                ? (Number(x.amount || 0) /
                    totalExpense) *
                  100
                : 0;

            return (
              <tr key={x.category}>
                <td>
                  <strong>{index + 1}</strong>
                </td>

                <td>
                  <strong>{x.category}</strong>
                </td>

                <td className="expense-value">
                  {money(x.amount)}
                </td>

                <td>
                  <strong>
                    {percentage.toFixed(1)}%
                  </strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="muted">
      No expenses for the selected period.
    </p>
  )}
</section>

    {/* =========================
        LAST 6 MONTHS
    ========================= */}

<section className="report-card">
  <div className="section-heading">
    <div>
      <span>6 MONTHS</span>

      <h3>
        Financial Trend
      </h3>
    </div>
  </div>

  <div className="financial-trend-table-wrap">
    <table className="financial-trend-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Income</th>
          <th>Expense</th>
          <th>Savings</th>
          <th>Savings %</th>
        </tr>
      </thead>

      <tbody>
        {last6Months.map((x) => {
          const savingsPercent =
            Number(x.income) > 0
              ? (Number(x.savings) / Number(x.income)) * 100
              : 0;

          return (
            <tr key={x.monthKey}>
              <td>
                <strong>{x.label}</strong>
              </td>

              <td>
                {money(x.income)}
              </td>

              <td>
                {money(x.expense)}
              </td>

              <td>
                <strong>
                  {money(x.savings)}
                </strong>
              </td>

              <td>
                <strong>
                  {savingsPercent.toFixed(0)}%
                </strong>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
</section>

    {/* =========================
        TOP 3 EXPENSE CATEGORIES
    ========================= */}

    <section className="report-card">
      <div className="section-heading">
        <div>
          <span>TOP SPENDING</span>

          <h3>
            Top 3 Expense Categories
          </h3>
        </div>
      </div>

      {categoryTotals.length ? (
        categoryTotals
          .slice(0, 3)
          .map((x, index) => (
            <div
              className="report-row"
              key={x.category}
            >
              <strong>
                {index + 1}.{" "}
                {x.category}
              </strong>

              <strong>
                {money(x.amount)}
              </strong>
            </div>
          ))
      ) : (
        <p className="muted">
          No expenses for the selected period.
        </p>
      )}
    </section>
  </>
)}

          {activePage === "settings" && (
            <>
              <PageHead
                eyebrow="PREFERENCES"
                title="Settings"
                text="Manage your Maza Hishob data and backups"
              />

              <section className="settings-card profile-settings-card">
                <div className="settings-card-copy">
                  <div className="settings-title-row">
                    <span className="settings-profile-avatar">
                      {profilePhotoUrl ? (
                        <img src={profilePhotoUrl} alt="Profile" />
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Zm7 7.8a7 7 0 0 0-14 0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </span>
                    <div>
                      <h3>Profile</h3>
                      <span className="settings-subtle">
                        {session?.user?.email || "Signed-in account"}
                      </span>
                    </div>
                  </div>

                  <p>
                    Profile photo is optional and uploaded by you. Maza Hishob
                    does not automatically import your Google account photo.
                  </p>
                </div>

                <div className="settings-action-group">
                  <label
                    className={`secondary-btn file-btn ${
                      profilePhotoBusy ? "disabled" : ""
                    }`}
                  >
                    {profilePhotoBusy
                      ? "Working..."
                      : profilePhotoUrl
                      ? "Replace Photo"
                      : "Upload Photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={uploadProfilePhoto}
                      disabled={profilePhotoBusy}
                    />
                  </label>

                  {profilePhotoUrl && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={removeProfilePhoto}
                      disabled={profilePhotoBusy}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </section>

              <section className="settings-card session-security-card">
                <div className="settings-card-copy">
                  <div className="settings-title-row">
                    <span className="settings-icon-badge security-icon">⌛</span>
                    <div>
                      <h3>Session Security</h3>
                      <span className="settings-subtle">
                        5-minute inactivity protection
                      </span>
                    </div>
                  </div>

                  <p>
                    Maza Hishob automatically signs you out after 5 minutes
                    without activity and shows a warning 30 seconds before logout.
                    Your Google password is never received or stored by Maza Hishob.
                  </p>
                </div>

                <div className="session-security-status">
                  <span className="session-security-dot" />
                  Auto Sign-Out ON
                </div>
              </section>

              <section className="settings-card drive-card">
                <div className="settings-card-copy">
                  <div className="settings-title-row">
                    <span className="settings-icon-badge drive-icon">☁</span>
                    <div>
                      <h3>Google Drive Backup</h3>
                      <span
                        className={`drive-status-badge ${
                          driveConnected ? "connected" : "disconnected"
                        }`}
                      >
                        {driveConnected
                          ? "Connected by you · Optional cloud backup"
                          : "Not Connected · Local backup still available"}
                      </span>
                    </div>
                  </div>

                  <p>
                    Google Drive is optional and never connects automatically.
                    Connect it only when you want cloud backup. Backups are saved
                    in the <strong> Maza Hishob Backups </strong> folder.
                    Local backup remains available even when Drive is disconnected.
                  </p>
                </div>

                <div className="settings-action-group">
                  {!driveConnected ? (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={connectGoogleDrive}
                      disabled={driveBusy}
                    >
                      {driveBusy
                        ? "Connecting..."
                        : "☁ Connect Google Drive"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={disconnectGoogleDrive}
                        disabled={driveBusy}
                      >
                        Disconnect Drive
                      </button>

                      <button
                        type="button"
                        className="primary-btn"
                        onClick={backupToGoogleDrive}
                        disabled={driveBusy || saving}
                      >
                        {driveBusy
                          ? "Working..."
                          : "☁ Backup to Drive"}
                      </button>
                    </>
                  )}
                </div>
              </section>

              <section className="settings-card drive-restore-card">
                <div className="settings-card-copy">
                  <div className="settings-title-row">
                    <span className="settings-icon-badge restore-icon">↥</span>
                    <div>
                      <h3>Restore from Google Drive</h3>
                      <span className="settings-subtle">
                        Choose one of your Maza Hishob backups
                      </span>
                    </div>
                  </div>

                  <p>
                    Restoring replaces only the currently signed-in
                    user's Supabase data. Your Google Drive backup
                    file is not deleted.
                  </p>
                </div>

                {!driveConnected && (
                  <div className="drive-disconnected-note">
                    Google Drive is optional and currently disconnected.
                    Use Local Backup below, or connect Drive only when you want cloud backup.
                  </div>
                )}

                <div className="drive-restore-controls drive-backup-manager">
                  <div className="drive-manager-head">
                    <div>
                      <strong>Cloud Backups</strong>
                      <span>
                        {driveConnected
                          ? `${driveBackups.length} backup${driveBackups.length === 1 ? "" : "s"} loaded`
                          : "Connect Drive to view backups"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => listDriveBackups()}
                      disabled={driveBusy || !driveConnected}
                    >
                      ↻ Refresh Backups
                    </button>
                  </div>

                  {driveConnected && driveBackups.length > 0 ? (
                    <div className="drive-backup-list">
                      {driveBackups.map((file) => (
                        <div
                          className={`drive-backup-item ${
                            selectedDriveBackupId === file.id ? "selected" : ""
                          }`}
                          key={file.id}
                          onClick={() => setSelectedDriveBackupId(file.id)}
                        >
                          <div className="drive-backup-info">
                            <strong>{file.name}</strong>
                            <span>
                              {file.createdTime
                                ? new Date(file.createdTime).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Google Drive backup"}
                            </span>
                          </div>

                          <div className="drive-backup-actions">
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDriveBackupId(file.id);
                                restoreFromGoogleDrive(file.id);
                              }}
                              disabled={driveBusy || saving}
                            >
                              Restore
                            </button>

                            <button
                              type="button"
                              className="danger-btn drive-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDriveBackupId(file.id);
                                deleteSelectedDriveBackup(file.id);
                              }}
                              disabled={driveBusy}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : driveConnected ? (
                    <div className="drive-backup-empty">
                      No Google Drive backups found. Create a backup first.
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card-copy">
                  <div className="settings-title-row">
                    <span className="settings-icon-badge local-icon">↓</span>
                    <div>
                      <h3>Download Local Backup</h3>
                      <span className="settings-subtle">
                        Keep an offline copy on this device
                      </span>
                    </div>
                  </div>

                  <p>
                    Download a complete JSON copy of your current
                    financial data.
                  </p>
                </div>

                <button
                  className="secondary-btn"
                  onClick={exportData}
                  disabled={saving || localBackupBusy}
                >
                  {localBackupBusy
                    ? "Preparing Backup..."
                    : Capacitor.isNativePlatform()
                    ? "↓ Save / Share Backup"
                    : "↓ Download Backup"}
                </button>
              </section>

              <section className="settings-card">
                <div className="settings-card-copy">
                  <div className="settings-title-row">
                    <span className="settings-icon-badge local-restore-icon">↑</span>
                    <div>
                      <h3>Restore Local Backup</h3>
                      <span className="settings-subtle">
                        Restore a previously downloaded JSON backup
                      </span>
                    </div>
                  </div>

                  <p>
                    The selected backup will replace the current
                    signed-in user's data in Supabase after confirmation.
                  </p>
                </div>

                <label className="secondary-btn file-btn">
                  ↑ Choose Backup
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={importData}
                    disabled={saving}
                  />
                </label>
              </section>

              <section className="settings-card danger-card">
                <div>
                  <h3>Reset All Data</h3>
                  <p>
                    This permanently clears only the currently
                    signed-in user's Maza Hishob data from Supabase.
                  </p>
                </div>

                <button
                  className="danger-btn"
                  disabled={saving || driveBusy}
                  onClick={resetAll}
                >
                  Reset Data
                </button>
              </section>

              {backupMessage && (
                <div className="success-note backup-status-note">
                  {backupMessage}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {ledgerPeriodPicker && (
        <div
          className="ledger-period-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ledger-period-dialog-title"
        >
          <button
            type="button"
            className="ledger-period-dialog-backdrop"
            aria-label="Close period selection"
            onClick={() => setLedgerPeriodPicker(null)}
          />

          <section className="ledger-period-dialog-card">
            <header>
              <div>
                <span>EXPENSE OVERVIEW</span>
                <h3 id="ledger-period-dialog-title">
                  {ledgerPeriodPicker === "month" ? "Select month" : "Select year"}
                </h3>
              </div>
              <button
                type="button"
                className="ledger-period-dialog-close"
                aria-label="Close period selection"
                onClick={() => setLedgerPeriodPicker(null)}
              >
                ×
              </button>
            </header>

            {ledgerPeriodPicker === "month" ? (
              <>
                <strong className="ledger-picker-current-period">
                  {dashboardMonths.find(([value]) => value === ledgerPickerMonth)?.[1]}
                  {" "}
                  {ledgerPickerYear}
                </strong>

                <div className="ledger-picker-year-stepper">
                  <button
                    type="button"
                    aria-label="Previous year"
                    onClick={() => setLedgerPickerYear((year) => year - 1)}
                  >
                    ‹
                  </button>
                  <strong>{ledgerPickerYear}</strong>
                  <button
                    type="button"
                    aria-label="Next year"
                    onClick={() => setLedgerPickerYear((year) => year + 1)}
                  >
                    ›
                  </button>
                </div>

                <div className="ledger-month-picker-grid">
                  {dashboardMonths.map(([value, label]) => (
                    <button
                      type="button"
                      key={`ledger-picker-${value}`}
                      className={ledgerPickerMonth === value ? "active" : ""}
                      aria-pressed={ledgerPickerMonth === value}
                      onClick={() => setLedgerPickerMonth(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <footer>
                  <button
                    type="button"
                    className="ledger-picker-cancel"
                    onClick={() => setLedgerPeriodPicker(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ledger-picker-apply"
                    onClick={applyLedgerMonthPicker}
                  >
                    Apply
                  </button>
                </footer>
              </>
            ) : (
              <>
                <div className="ledger-year-picker-grid">
                  {ledgerPickerYears.map((year) => (
                    <button
                      type="button"
                      key={`ledger-year-${year}`}
                      className={ledgerSelectedYear === year ? "active" : ""}
                      aria-pressed={ledgerSelectedYear === year}
                      onClick={() => selectLedgerYear(year)}
                    >
                      {year}
                    </button>
                  ))}
                </div>

                <footer>
                  <button
                    type="button"
                    className="ledger-picker-cancel"
                    onClick={() => setLedgerPeriodPicker(null)}
                  >
                    Cancel
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}

      {sessionWarningOpen && (
        <div
          className="session-timeout-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="session-timeout-title"
        >
          <div className="session-timeout-backdrop" />

          <div className="session-timeout-card">
            <div className="session-timeout-icon" aria-hidden="true">5</div>

            <span className="eyebrow">SECURITY</span>
            <h3 id="session-timeout-title">Still using Maza Hishob?</h3>
            <p>
              For your security, you will be signed out after 5 minutes of
              inactivity.
            </p>

            <div className="session-timeout-countdown" aria-live="polite">
              <strong>{sessionSecondsLeft}</strong>
              <span>seconds remaining</span>
            </div>

            <button
              type="button"
              className="primary-btn session-stay-btn"
              onClick={() => window.__mhStaySignedIn?.()}
            >
              Stay Signed In
            </button>
          </div>
        </div>
      )}

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
                      <span className={`category-mini-icon category-${String(c).toLowerCase().replace(/\s+/g, "-")}`}>
                        {c === "Food"
                          ? "●"
                          : c === "Grocery"
                          ? "▣"
                          : c === "Bills"
                          ? "▤"
                          : c === "Travel"
                          ? "✈"
                          : c === "Shopping"
                          ? "◆"
                          : c === "Medical"
                          ? "+"
                          : "•••"}
                      </span>
                      <span>{c}</span>
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
                  Expense Name / Note{" "}
                  <span>
                    Optional
                  </span>
                </>
              }
            >
              <div className="expense-note-autocomplete">
                <input
                  className="form-input"
                  value={expenseForm.note}
                  onChange={(e) => {
                    setExpenseForm((current) => ({
                      ...current,
                      note: e.target.value,
                    }));
                    setExpenseSuggestionOpen(true);
                  }}
                  onFocus={() => setExpenseSuggestionOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setExpenseSuggestionOpen(false), 140);
                  }}
                  placeholder="Start typing, e.g. Milk or Petrol"
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={
                    expenseSuggestionOpen && matchingExpenseSuggestions.length > 0
                  }
                  aria-controls="expense-suggestion-list"
                />

                {expenseSuggestionOpen && matchingExpenseSuggestions.length > 0 && (
                  <div
                    id="expense-suggestion-list"
                    className="expense-suggestion-menu"
                    role="listbox"
                    aria-label="Previous expense suggestions"
                  >
                    {matchingExpenseSuggestions.map((suggestion) => (
                      <button
                        type="button"
                        role="option"
                        className="expense-suggestion-option"
                        key={suggestion.note}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => applyExpenseSuggestion(suggestion)}
                      >
                        <strong>{suggestion.note}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!editing && expenseSuggestions.length > 0 && (
                <small className="expense-suggestion-hint">
                  Select a previous entry name. Amount stays unchanged.
                </small>
              )}
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
    subtitle="Track your loan history and current repayment status"
    onClose={closeModal}
  >
    <form onSubmit={saveLoan}>

      {/* =================================================
          SECTION 1 — LOAN HISTORY
          Historical data only
          No calculation is based on these fields
      ================================================= */}

      <div className="form-section">
        <div className="form-section-heading">
          <span>SECTION 1</span>

          <h4>Loan History</h4>

          <p>
            Enter the original loan details and amounts
            already paid till date.
          </p>
        </div>

        <Field label="Loan Name">
          <input
            className="form-input"
            required
            value={loanForm.loanName}
            onChange={(e) =>
              setLoanForm((p) => ({
                ...p,
                loanName:
                  e.target.value,
              }))
            }
            placeholder="e.g. Home Loan"
          />
        </Field>

        <Field label="Bank / Lender Name">
          <input
            className="form-input"
            value={loanForm.lender}
            onChange={(e) =>
              setLoanForm((p) => ({
                ...p,
                lender:
                  e.target.value,
              }))
            }
            placeholder="e.g. HDFC Bank"
          />
        </Field>

        <Field label="Original Loan Amount">
          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            required
            value={loanForm.amount}
            onChange={(e) =>
              setLoanForm((p) => ({
                ...p,
                amount:
                  e.target.value,
              }))
            }
            placeholder="0.00"
          />
        </Field>

        <div className="form-row">

          <Field label="Principal Paid Till Date">
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={
                loanForm.principalPaidTillDate ||
                ""
              }
              onChange={(e) =>
                setLoanForm((p) => ({
                  ...p,
                  principalPaidTillDate:
                    e.target.value,
                }))
              }
              placeholder="0.00"
            />
          </Field>

          <Field label="Interest Paid Till Date">
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={
                loanForm.interestPaidTillDate ||
                ""
              }
              onChange={(e) =>
                setLoanForm((p) => ({
                  ...p,
                  interestPaidTillDate:
                    e.target.value,
                }))
              }
              placeholder="0.00"
            />
          </Field>

        </div>

        <Field label="Original Loan Start Date">
          <input
            className="form-input"
            type="date"
            required
            value={
              loanForm.originalLoanStartDate ||
              ""
            }
            onChange={(e) =>
              setLoanForm((p) => ({
                ...p,
                originalLoanStartDate:
                  e.target.value,
              }))
            }
          />
        </Field>
      </div>


      {/* =================================================
          SECTION 2 — CURRENT LOAN STATUS
          All loan calculations are based on this section
      ================================================= */}

      <div className="form-section">

        <div className="form-section-heading">
          <span>SECTION 2</span>

          <h4>Current Loan Status</h4>

          <p>
            These values are used for EMI, interest,
            principal and remaining tenure calculations.
          </p>
        </div>

        <div className="form-row">
          <Field label="Loan Tracking Date">
            <input
              className="form-input"
              type="date"
              required
              value={loanForm.trackingDate || ""}
              onChange={(e) =>
                setLoanForm((p) => ({
                  ...p,
                  trackingDate: e.target.value,
                }))
              }
            />
          </Field>

          <Field label="Current Outstanding Principal">
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              required
              value={loanForm.outstanding}
              onChange={(e) =>
                setLoanForm((p) => ({
                  ...p,
                  outstanding: e.target.value,
                }))
              }
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="form-row">

          <Field label="Interest Rate %">
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              required
              value={loanForm.interestRate}
              onChange={(e) =>
                setLoanForm((p) => ({
                  ...p,
                  interestRate:
                    e.target.value,
                }))
              }
              placeholder="e.g. 8.60"
            />
          </Field>

          <Field label="Pending Tenure (Months)">
            <input
              className="form-input"
              type="number"
              min="0"
              step="1"
              required
              value={loanForm.tenure}
              onChange={(e) =>
                setLoanForm((p) => ({
                  ...p,
                  tenure:
                    e.target.value,
                }))
              }
              placeholder="e.g. 80"
            />
          </Field>

        </div>

        <div className="form-row">

          <Field label="Monthly EMI">
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              required
              value={loanForm.emi}
              onChange={(e) =>
                setLoanForm((p) => ({
                  ...p,
                  emi:
                    e.target.value,
                }))
              }
              placeholder="0.00"
            />
          </Field>

          <Field label="Next EMI Date">
            <input
              className="form-input"
              type="date"
              required
              value={
                loanForm.nextEmiDate ||
                ""
              }
              onChange={(e) =>
                setLoanForm((p) => ({
                  ...p,
                  nextEmiDate:
                    e.target.value,
                }))
              }
            />
          </Field>

        </div>

      </div>


      {/* =================================================
          SECTION 3 — ADDITIONAL INFORMATION
      ================================================= */}

      <div className="form-section">

        <div className="form-section-heading">
          <span>SECTION 3</span>

          <h4>Additional Information</h4>

          <p>
            Optional information about this loan.
          </p>
        </div>

        <Field label="Loan Type">
          <select
            className="form-input"
            value={loanForm.loanType}
            onChange={(e) =>
              setLoanForm((p) => ({
                ...p,
                loanType:
                  e.target.value,
              }))
            }
          >
            {loanTypes.map((x) => (
              <option key={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>

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
            value={loanForm.note}
            onChange={(e) =>
              setLoanForm((p) => ({
                ...p,
                note:
                  e.target.value,
              }))
            }
            placeholder="e.g. Home construction loan"
          />
        </Field>

      </div>


      {/* =================================================
          ACTIONS
      ================================================= */}

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
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                marginTop: "16px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                onClick={closeModal}
              >
                Close
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={applyPrepayment}
                disabled={!prepayResult || saving}
              >
                {saving ? "Applying..." : "Apply Prepayment"}
              </button>
            </div>
          </Modal>
        )}
       
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
    <div
      className="expense-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Background only — NO close action */}
      <div
        className="modal-overlay"
        aria-hidden="true"
      />

      <div
        className="modal-card"
        onClick={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
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
            type="button"
            className="modal-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export default App;
