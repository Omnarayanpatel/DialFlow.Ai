import React, { useEffect, useMemo, useRef, useState } from "react";

import LogoutConfirmationModal from "../../components/common/LogoutConfirmationModal";
import ThemeToggle from "../../components/common/ThemeToggle";
import AgentRanking from "../../components/ranking/AgentRanking";
import { clearAgentSessionCache, updateUserStatus } from "../../services/authService";
import { createDowntimeRequest, getMyCurrentDowntimeRequest } from "../../services/downtimeService";
import { createAgentResponse, getAgentDashboardData, updateAgentHistoryEntry } from "../../services/responseService";
import { createDowntimeSocket } from "../../services/socketService";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../theme/useTheme";

const sidebarMenu = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "ranking", label: "Ranking", icon: "chart" },
  { id: "history", label: "My history", icon: "history" },
  { id: "profile", label: "My profile", icon: "profile" },
];

const dispositionOptions = [
  "Busy",
  "Call Back",
  "Customer Disconnect Call",
  "Language Barrier",
  "Not Interested",
  "Ringing Busy",
  "RNR",
  "Voice Mail",
  "Out Of Service",
  "Switch Off",
  "Abusive Customer",
  "Incoming Call Not Available",
  "Rejected",
  "Closed",
  "Positive",
  "Already Positive",
  "Invalid Number",
  "Wrong Number",
  "Other",
];

const callStatusOptions = ["Connected", "Not Connected"];

const subDispositionMap = {
  "Call Back": [
    "Concern Person Not Available",
    "Want Callback by Evening",
    "Want Callback by Tomorrow",
    "Want Callback after 1 hour",
    "Link Not Working",
    "Other",
  ],
  "Not Interested": [
    "Already Taken Loan",
    "Amount Not Needed",
    "High Processing Fees",
    "High ROI",
    "Reason Not Shared",
    "Require High Amount",
    "Not Applied",
    "Other",
  ],
};

const languageOptions = [
  "NA",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Marathi",
  "Punjabi",
  "Kannada",
  "Bengali",
  "Other",
];

const breakReasonOptions = ["Lunch Break", "Tea Break", "Bio Break", "Session"];
const breakReasonsWithRemark = new Set(["Session"]);
const downtimeIssueTypes = ["System Issue", "Internet Issue", "Portal Issue", "Dialer Issue"];
const downtimeSocketEvents = [
  "new_downtime_request",
  "downtime_approved",
  "downtime_rejected",
  "downtime_resolved",
];

const fallbackSummary = {
  totalCalls: 0,
  connectedCalls: 0,
  notConnectedCalls: 0,
  positiveCalls: 0,
};

const fallbackRows = [];

const fallbackSession = {
  callsThisSession: 0,
  loginTime: null,
  totalLoginDuration: 0,
  totalLoginDurationToday: 0,
  total_login_time: 0,
  activeSessionDuration: 0,
  breakCountToday: 0,
  totalBreakDurationToday: 0,
  total_break_time: 0,
  staffTimeToday: 0,
  staff_time: 0,
  currentBreakDuration: 0,
  current_break_status: "none",
  activeSessionCount: 0,
  breakReason: "",
  breakRemark: "",
  breakStartTime: null,
  breakEndTime: null,
  status: "offline",
  serverTime: null,
};

const shell = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(120, 62, 255, 0.14), transparent 24%), linear-gradient(180deg, #0b0a16 0%, #0a0914 100%)",
  color: "#f5f1ff",
  fontFamily: "Segoe UI, sans-serif",
};

const panel = {
  background: "rgba(19, 18, 37, 0.96)",
  border: "1px solid rgba(120, 81, 255, 0.28)",
  borderRadius: "24px",
  boxSizing: "border-box",
};

const fieldBase = {
  width: "100%",
  background: "rgba(57, 56, 51, 0.92)",
  color: "#f5f2eb",
  border: "1px solid rgba(150, 139, 93, 0.2)",
  borderRadius: "14px",
  padding: "16px 18px",
  fontSize: "18px",
  outline: "none",
  boxSizing: "border-box",
};

const modalButton = {
  padding: "12px 18px",
  borderRadius: "12px",
  border: "1px solid rgba(166, 108, 255, 0.34)",
  background: "transparent",
  color: "#f5f1ff",
  cursor: "pointer",
  fontSize: "15px",
};

const statusTone = (value) => {
  if (value === "Connected") {
    return { bg: "rgba(43, 202, 154, 0.14)", color: "#37e0aa" };
  }

  if (value === "Not Connected") {
    return { bg: "rgba(255, 107, 138, 0.14)", color: "#ff8fa2" };
  }

  return { bg: "rgba(140, 143, 173, 0.16)", color: "#afb6d4" };
};

const normalizeCallStatus = (value) => {
  if (!value) {
    return "NA";
  }

  if (value === "connected") {
    return "Connected";
  }

  if (value === "not_connected") {
    return "Not Connected";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(Number.parseInt(seconds, 10) || 0, 0);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const toSeconds = (value) => Math.max(Number.parseInt(value, 10) || 0, 0);

const formatStatusDateTime = (value) => {
  if (!value) {
    return "NA";
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "NA";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(parsed);
};

const downtimeStatusLabel = (status) => {
  const value = String(status || "").toLowerCase();

  if (value === "pending") return "Pending Approval";
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  if (value === "resolved") return "Resolved";

  return "No Request";
};

const downtimeStatusTone = (status) => {
  const value = String(status || "").toLowerCase();

  if (value === "pending") return { color: "#ffd02d", border: "rgba(255, 208, 45, 0.42)", bg: "rgba(255, 208, 45, 0.12)" };
  if (value === "approved") return { color: "#35e5a7", border: "rgba(53, 229, 167, 0.42)", bg: "rgba(53, 229, 167, 0.12)" };
  if (value === "rejected") return { color: "#ff7685", border: "rgba(255, 118, 133, 0.42)", bg: "rgba(255, 118, 133, 0.12)" };
  if (value === "resolved") return { color: "#9bdcff", border: "rgba(39, 216, 255, 0.42)", bg: "rgba(39, 216, 255, 0.12)" };

  return { color: "#afb6d4", border: "rgba(140, 143, 173, 0.32)", bg: "rgba(140, 143, 173, 0.12)" };
};

const formatTime = (date) => {
  if (!date) {
    return "NA";
  }

  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "NA";
  }

  return (
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed)
  );
};

const toDateInputValue = (date) => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const historyGroupLabel = (group) => {
  if (group === "today") {
    return "Today";
  }

  if (group === "yesterday") {
    return "Yesterday";
  }

  return "Older records";
};

const normalizeRecords = (records) =>
  records.map((item) => ({
    refId: item.reference_id || `REF-${item.id}`,
    status: normalizeCallStatus(item.call_status),
    disposition: item.disposition || "NA",
    subDisposition: item.sub_disposition || "NA",
  }));

const toHistoryEditForm = (record = {}) => ({
  callStatus: normalizeCallStatus(record.call_status) === "NA" ? "Not Connected" : normalizeCallStatus(record.call_status),
  disposition: record.disposition || "RNR",
  subDisposition: record.sub_disposition || "NA",
  language: record.language || "NA",
  languageOther: record.language_other || "",
});

const iconFor = (type) => {
  if (type === "grid") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#b585ff" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#b585ff" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#b585ff" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#b585ff" />
      </svg>
    );
  }

  if (type === "form") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="3" stroke="#b585ff" strokeWidth="2" />
        <path d="M8 9H16" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 14H13" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "chart") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 18L9 13L13 15L20 7" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20H20" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "profile") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#b585ff" strokeWidth="2" />
        <path d="M5 19C6.8 15.8 9 14.5 12 14.5C15 14.5 17.2 15.8 19 19" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "logout") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M10 5H6.5C5.7 5 5 5.7 5 6.5V17.5C5 18.3 5.7 19 6.5 19H10" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 8L18 12L14 16" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 12H9" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#b585ff" strokeWidth="2" />
      <path d="M12 7V12L15.5 14.5" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const aiStar = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z"
      fill="#b98cff"
      stroke="#dcc8ff"
      strokeWidth="1.2"
    />
  </svg>
);

const lockIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 10V8.5C7 5.74 9.24 3.5 12 3.5C14.76 3.5 17 5.74 17 8.5V10"
      stroke="#5c5675"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <rect x="5.5" y="10" width="13" height="10" rx="2.5" fill="rgba(92,86,117,0.16)" />
    <rect x="5.5" y="10" width="13" height="10" rx="2.5" stroke="#5c5675" strokeWidth="1.5" />
  </svg>
);

const Dashboard = () => {
  const { user, token } = useStore();
  const { theme, toggleTheme } = useTheme();
  const [activeView, setActiveView] = useState("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dashboardSyncKey, setDashboardSyncKey] = useState(0);

  // Session-based Agent Info state (to be filled once upon login)
  const [empId, setEmpId] = useState(user.employeeId || "");
  const [empName, setEmpName] = useState(user.name || "");
  const [zohoId, setZohoId] = useState(user.zohoId || "");
  const [dialerId, setDialerId] = useState(user.dialerId || "");
  const [isInfoLocked, setIsInfoLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [breakReason, setBreakReason] = useState("Lunch Break");
  const [breakRemark, setBreakRemark] = useState("");
  const [breakSaving, setBreakSaving] = useState(false);
  const [isDowntimeModalOpen, setIsDowntimeModalOpen] = useState(false);
  const [downtimeIssueType, setDowntimeIssueType] = useState("System Issue");
  const [downtimeComment, setDowntimeComment] = useState("");
  const [downtimeSaving, setDowntimeSaving] = useState(false);
  const [currentDowntimeRequest, setCurrentDowntimeRequest] = useState(null);

  const [referenceId, setReferenceId] = useState("");
  const [callStatus, setCallStatus] = useState("Not Connected");
  const [callStatusOther, setCallStatusOther] = useState("");
  const [language, setLanguage] = useState("NA");
  const [languageOther, setLanguageOther] = useState("");
  const [disposition, setDisposition] = useState("RNR");
  const [dispositionOther, setDispositionOther] = useState("");
  const [subDisposition, setSubDisposition] = useState("NA");
  const [subDispositionOther, setSubDispositionOther] = useState("");
  const [summary, setSummary] = useState(fallbackSummary);
  const [sessionStats, setSessionStats] = useState(fallbackSession);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [rows, setRows] = useState(fallbackRows);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [historyFilters, setHistoryFilters] = useState({
    date: "",
    referenceId: "",
    callStatus: "all",
    disposition: "all",
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [historyEditTarget, setHistoryEditTarget] = useState(null);
  const [historyEditForm, setHistoryEditForm] = useState(toHistoryEditForm());
  const [historyEditSaving, setHistoryEditSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLogoutConfirmationOpen, setIsLogoutConfirmationOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const clockIntervalRef = useRef(null);
  const dashboardSyncIntervalRef = useRef(null);

  useEffect(() => {
    document.title = "Agent Dashboard | Dialflow.ai";
  }, []);

  const resetDashboardSessionState = () => {
    setSessionStats(fallbackSession);
    setSummary(fallbackSummary);
    setRows(fallbackRows);
    setHistoryRecords([]);
    setHistoryPagination({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    });
    setIsPaused(false);
    setIsBreakModalOpen(false);
    setBreakReason("Lunch Break");
    setBreakRemark("");
    setIsDowntimeModalOpen(false);
    setDowntimeIssueType("System Issue");
    setDowntimeComment("");
    setCurrentDowntimeRequest(null);
    setIsSessionHydrated(false);
  };

  const showDisposition = true;
  const subDispositionOptions = useMemo(
    () => (subDispositionMap[disposition] ? subDispositionMap[disposition] : ["NA"]),
    [disposition]
  );
  const showSubDisposition = showDisposition && Object.prototype.hasOwnProperty.call(subDispositionMap, disposition);
  const showOtherLanguage = language === "Other";
  const showOtherDisposition = disposition === "Other";
  const showOtherSubDisposition = subDisposition === "Other";
  const showOtherCallStatus = callStatus === "Other";
  const historyEditSubDispositionOptions = useMemo(
    () => (subDispositionMap[historyEditForm.disposition] ? subDispositionMap[historyEditForm.disposition] : ["NA"]),
    [historyEditForm.disposition]
  );
  const historyEditShowSubDisposition = Object.prototype.hasOwnProperty.call(subDispositionMap, historyEditForm.disposition);
  const historyEditShowOtherLanguage = historyEditForm.language === "Other";

  const setDowntimeRequestFromServer = (request) => {
    setCurrentDowntimeRequest(request ? { ...request, syncedAtMs: Date.now() } : null);
  };

  const loadCurrentDowntimeRequest = async () => {
    if (!token) {
      setCurrentDowntimeRequest(null);
      return;
    }

    try {
      const data = await getMyCurrentDowntimeRequest(token);
      setDowntimeRequestFromServer(data.request || null);
    } catch (_error) {
      setCurrentDowntimeRequest(null);
    }
  };

  useEffect(() => {
    clockIntervalRef.current = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (clockIntervalRef.current) {
        window.clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    dashboardSyncIntervalRef.current = window.setInterval(() => {
      setDashboardSyncKey((current) => current + 1);
    }, 5000);

    return () => {
      if (dashboardSyncIntervalRef.current) {
        window.clearInterval(dashboardSyncIntervalRef.current);
        dashboardSyncIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const requestBackendSync = () => {
      setDashboardSyncKey((current) => current + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestBackendSync();
      }
    };

    window.addEventListener("online", requestBackendSync);
    window.addEventListener("focus", requestBackendSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", requestBackendSync);
      window.removeEventListener("focus", requestBackendSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    clearAgentSessionCache();
    resetDashboardSessionState();
    setDashboardSyncKey((current) => current + 1);
  }, [token, user.id, user.employeeId]);

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      if (!token) {
        resetDashboardSessionState();
        return;
      }

      try {
        setHistoryLoading(true);
        const data = await getAgentDashboardData(token, {
          history: {
            page: historyPagination.page,
            pageSize: historyPagination.pageSize,
            ...historyFilters,
          },
        });

        if (ignore) {
          return;
        }

        const history = data.history || [];
        const lastWithIds = history.find((item) => item.zoho_id || item.dialer_id);
        if (lastWithIds) {
          setZohoId((current) => current || lastWithIds.zoho_id || "");
          setDialerId((current) => current || lastWithIds.dialer_id || "");
        }

        setHistoryRecords(history);
        setHistoryPagination((current) => ({ ...current, ...(data.pagination || {}) }));
        setRows(normalizeRecords(data.recentToday || []));
        setSummary(data.summary || fallbackSummary);
        const nextSession = {
          ...fallbackSession,
          ...(data.session || {}),
          syncedAtMs: Date.now(),
        };

        if (nextSession.status === "offline") {
          resetDashboardSessionState();
          clearAgentSessionCache({ clearAuth: true });
          window.location.assign("/login");
          return;
        }

        setSessionStats(nextSession);
        setIsPaused(nextSession.status === "break");
        setIsSessionHydrated(true);
        loadCurrentDowntimeRequest();
      } catch (_error) {
        if (!ignore) {
          setRows(fallbackRows);
          setHistoryRecords([]);
          setSummary(fallbackSummary);
          setSessionStats(fallbackSession);
          setIsPaused(false);
          setIsSessionHydrated(false);
        }
      } finally {
        if (!ignore) {
          setHistoryLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [
    token,
    dashboardSyncKey,
    historyPagination.page,
    historyPagination.pageSize,
    historyFilters.date,
    historyFilters.referenceId,
    historyFilters.callStatus,
    historyFilters.disposition,
  ]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = createDowntimeSocket(token);

    const handleDowntimeEvent = (request) => {
      if (!request?.id) {
        return;
      }

      if (request.agentId === user.id || request.employeeId === user.employeeId) {
        setDowntimeRequestFromServer(request);
      }
    };

    downtimeSocketEvents.forEach((eventName) => {
      socket.on(eventName, handleDowntimeEvent);
    });

    return () => {
      downtimeSocketEvents.forEach((eventName) => {
        socket.off(eventName, handleDowntimeEvent);
      });
      socket.disconnect();
    };
  }, [token, user.id, user.employeeId]);

  const resetForm = () => {
    setReferenceId("");
    setCallStatus("Not Connected");
    setCallStatusOther("");
    setLanguage("NA");
    setLanguageOther("");
    setDisposition("RNR");
    setDispositionOther("");
    setSubDisposition("NA");
    setSubDispositionOther("");
  };

  const syncStatus = async (status, breakDetails = {}) => {
    try {
      await updateUserStatus(status, token, breakDetails);
    } catch (err) {
      console.error("Failed to sync status:", err);
      throw err;
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    resetDashboardSessionState();
    if (clockIntervalRef.current) {
      window.clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    if (dashboardSyncIntervalRef.current) {
      window.clearInterval(dashboardSyncIntervalRef.current);
      dashboardSyncIntervalRef.current = null;
    }
    try {
      await syncStatus("Offline");
    } catch (_error) {
      console.error("Logout status sync failed");
    }
    clearAgentSessionCache({ clearAuth: true });
    window.location.replace("/login");
  };

  const openLogoutConfirmation = () => {
    setIsLogoutConfirmationOpen(true);
  };

  const closeLogoutConfirmation = () => {
    if (isLoggingOut) {
      return;
    }

    setIsLogoutConfirmationOpen(false);
  };

  const effectiveCallStatus = showOtherCallStatus ? callStatusOther || "Other" : callStatus;
  const effectiveDisposition = showOtherDisposition ? dispositionOther || "Other" : disposition;
  const effectiveSubDisposition = showOtherSubDisposition ? subDispositionOther || "Other" : subDisposition;
  const displayedSession = isSessionHydrated ? sessionStats : fallbackSession;
  const serverTotalLoginDurationToday = displayedSession.total_login_time ?? displayedSession.totalLoginDurationToday;
  const serverTotalBreakDurationToday = displayedSession.total_break_time ?? displayedSession.totalBreakDurationToday;
  const serverStaffTimeToday = displayedSession.staff_time ?? displayedSession.staffTimeToday;
  const serverCurrentBreakDuration = displayedSession.currentBreakDuration;
  const currentBreakStatus = displayedSession.current_break_status || (displayedSession.status === "break" ? "break" : "none");
  const sessionLoginTime = displayedSession.loginTime ? new Date(displayedSession.loginTime) : null;
  const secondsSinceBackendSync =
    isSessionHydrated && displayedSession.syncedAtMs
      ? Math.max(Math.floor((currentTime.getTime() - displayedSession.syncedAtMs) / 1000), 0)
      : 0;
  const isActiveSession = displayedSession.status === "online" || displayedSession.status === "break";
  const isOnBreak = displayedSession.status === "break" || currentBreakStatus === "break";
  const visualTotalLoginDurationToday = toSeconds(serverTotalLoginDurationToday) + (displayedSession.status === "online" ? secondsSinceBackendSync : 0);
  const visualTotalBreakDurationToday = toSeconds(serverTotalBreakDurationToday) + (isOnBreak ? secondsSinceBackendSync : 0);
  const visualStaffTimeToday = toSeconds(serverStaffTimeToday) + (isActiveSession ? secondsSinceBackendSync : 0);
  const visualCurrentBreakDuration = toSeconds(serverCurrentBreakDuration) + (isOnBreak ? secondsSinceBackendSync : 0);
  const currentDowntimeStatus = String(currentDowntimeRequest?.status || "").toLowerCase();
  const hasBlockingDowntimeRequest = currentDowntimeStatus === "pending" || currentDowntimeStatus === "approved";
  const currentDowntimeTone = downtimeStatusTone(currentDowntimeStatus);
  const currentDowntimeDuration = (() => {
    if (currentDowntimeStatus !== "approved" || !currentDowntimeRequest?.approvedAt) {
      return toSeconds(currentDowntimeRequest?.durationSeconds || currentDowntimeRequest?.runningDurationSeconds);
    }

    const approvedAtMs = new Date(currentDowntimeRequest.approvedAt).getTime();

    if (Number.isNaN(approvedAtMs)) {
      return toSeconds(currentDowntimeRequest.runningDurationSeconds);
    }

    return Math.max(
      Math.floor((currentTime.getTime() - approvedAtMs) / 1000),
      toSeconds(currentDowntimeRequest.runningDurationSeconds)
    );
  })();

  const handleTogglePause = async () => {
    if (!isPaused) {
      setBreakReason("Lunch Break");
      setBreakRemark("");
      setIsBreakModalOpen(true);
      return;
    }

    try {
      await syncStatus("Online");
      setDashboardSyncKey((current) => current + 1);
    } catch (_error) {
      setFeedback("Unable to end break. Please try again.");
    }
  };

  const closeBreakModal = () => {
    if (breakSaving) {
      return;
    }

    setIsBreakModalOpen(false);
  };

  const confirmBreak = async () => {
    if (!breakReason) {
      setFeedback("Please select a break reason.");
      return;
    }

    setBreakSaving(true);
    setFeedback("");

    try {
      await syncStatus("On break", {
        breakReason,
        breakRemark: breakReasonsWithRemark.has(breakReason) ? breakRemark : "",
      });
      setIsBreakModalOpen(false);
      setDashboardSyncKey((current) => current + 1);
    } catch (_error) {
      setFeedback("Unable to start break. Please try again.");
    } finally {
      setBreakSaving(false);
    }
  };

  const closeDowntimeModal = () => {
    if (downtimeSaving) {
      return;
    }

    setIsDowntimeModalOpen(false);
  };

  const submitDowntimeRequest = async () => {
    if (hasBlockingDowntimeRequest) {
      setFeedback("You already have an active downtime request.");
      return;
    }

    if (!downtimeIssueType) {
      setFeedback("Please select an issue type.");
      return;
    }

    if (!downtimeComment.trim()) {
      setFeedback("Please add a comment for the system issue.");
      return;
    }

    setDowntimeSaving(true);
    setFeedback("");

    try {
      const createdRequest = await createDowntimeRequest(
        {
          issue_type: downtimeIssueType,
          comment: downtimeComment.trim(),
        },
        token
      );
      setIsDowntimeModalOpen(false);
      setDowntimeIssueType("System Issue");
      setDowntimeComment("");
      setDowntimeRequestFromServer(createdRequest);
      setFeedback("Downtime request submitted. Timer starts after admin approval.");
    } catch (error) {
      setFeedback(error.message || "Unable to submit downtime request.");
    } finally {
      setDowntimeSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!token) {
      setFeedback("Login token missing. Please login first to connect dashboard with backend.");
      return;
    }

    if (displayedSession.status === "break") {
      setFeedback("You are currently on break. Please go Online to submit responses.");
      return;
    }

    if (!effectiveCallStatus) {
      setFeedback("Call status is required.");
      return;
    }

    setSubmitting(true);
    setFeedback("");

    try {
      const created = await createAgentResponse(
        {
          zohoId,
          dialerId: dialerId, // Use the dialerId from the session setup
          referenceId,
          callStatus: effectiveCallStatus,
          disposition: showDisposition ? effectiveDisposition : "NA",
          subDisposition: showDisposition && showSubDisposition ? effectiveSubDisposition : "NA",
          language: showOtherLanguage ? "Other" : language,
          languageOther: showOtherLanguage ? languageOther : "",
        },
        token
      );

      setRows((current) => [
        {
          refId: created.reference_id || referenceId || `REF-${created.id}`,
          status: normalizeCallStatus(created.call_status),
          disposition: created.disposition || "NA",
          subDisposition: created.sub_disposition || "NA",
        },
        ...current,
      ].slice(0, 5));
      const createdDate = created.created_at ? toDateInputValue(new Date(created.created_at)) : toDateInputValue(new Date());
      const matchesCurrentHistory =
        (!historyFilters.date || historyFilters.date === createdDate) &&
        (!historyFilters.referenceId ||
          (created.reference_id || "").toLowerCase().includes(historyFilters.referenceId.toLowerCase())) &&
        (historyFilters.callStatus === "all" || created.call_status === historyFilters.callStatus) &&
        (historyFilters.disposition === "all" || created.disposition === historyFilters.disposition);

      setHistoryRecords((current) => {
        if (historyPagination.page !== 1 || !matchesCurrentHistory) {
          return current;
        }

        return [{ ...created, history_group: "today" }, ...current].slice(0, historyPagination.pageSize);
      });
      if (matchesCurrentHistory) {
        setHistoryPagination((current) => ({ ...current, total: current.total + 1 }));
      }

      setSummary((current) => ({
        totalCalls: current.totalCalls + 1,
        connectedCalls:
          normalizeCallStatus(created.call_status) === "Connected"
            ? current.connectedCalls + 1
            : current.connectedCalls,
        notConnectedCalls:
          normalizeCallStatus(created.call_status) === "Not Connected"
            ? current.notConnectedCalls + 1
            : current.notConnectedCalls,
        positiveCalls:
          created.disposition === "Positive" || created.disposition === "Already Positive"
            ? current.positiveCalls + 1
            : current.positiveCalls,
      }));
      setSessionStats((current) => ({ ...current, callsThisSession: current.callsThisSession + 1 }));

      setFeedback("Response submitted successfully.");
      if (created.zoho_id || created.dialer_id) {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...storedUser,
            zohoId: created.zoho_id || storedUser.zohoId,
            dialerId: created.dialer_id || storedUser.dialerId,
          })
        );
      }
      resetForm();
    } catch (error) {
      setFeedback(error.message || "Unable to submit response.");
    } finally {
      setSubmitting(false);
    }
  };

  const openHistoryEdit = (record) => {
    if (!record?.is_editable) {
      return;
    }

    setHistoryEditTarget(record);
    setHistoryEditForm(toHistoryEditForm(record));
    setFeedback("");
  };

  const closeHistoryEdit = () => {
    if (historyEditSaving) {
      return;
    }

    setHistoryEditTarget(null);
    setHistoryEditForm(toHistoryEditForm());
  };

  const handleHistoryEditSave = async (event) => {
    event.preventDefault();

    if (!historyEditTarget || !token) {
      return;
    }

    setHistoryEditSaving(true);
    setFeedback("");

    try {
      const updated = await updateAgentHistoryEntry(
        historyEditTarget.id,
        {
          callStatus: historyEditForm.callStatus,
          disposition: historyEditForm.disposition,
          subDisposition: historyEditShowSubDisposition ? historyEditForm.subDisposition : "NA",
          language: historyEditForm.language,
          languageOther: historyEditShowOtherLanguage ? historyEditForm.languageOther : "",
        },
        token
      );

      setHistoryRecords((current) =>
        current.map((record) => (record.id === updated.id ? { ...record, ...updated } : record))
      );
      setRows((current) =>
        current.map((record) =>
          record.refId === (updated.reference_id || `REF-${updated.id}`)
            ? {
                refId: updated.reference_id || `REF-${updated.id}`,
                status: normalizeCallStatus(updated.call_status),
                disposition: updated.disposition || "NA",
                subDisposition: updated.sub_disposition || "NA",
              }
            : record
        )
      );
      setFeedback("History entry updated successfully.");
      setHistoryEditTarget(null);
      setDashboardSyncKey((current) => current + 1);
    } catch (error) {
      setFeedback(error.message || "Unable to update history entry.");
    } finally {
      setHistoryEditSaving(false);
    }
  };

  const historyRowsWithSections = historyRecords.flatMap((item, index) => {
    const currentGroup = item.history_group || "older";
    const previousGroup = historyRecords[index - 1]?.history_group || null;

    return currentGroup !== previousGroup
      ? [{ type: "section", id: `section-${currentGroup}-${index}`, label: historyGroupLabel(currentGroup) }, item]
      : [item];
  });
  const isLightTheme = theme === "light";
  const breakModalTheme = isLightTheme
    ? {
        overlay: "rgba(83, 62, 124, 0.18)",
        cardBg: "linear-gradient(180deg, #ffffff 0%, #f8f5ff 100%)",
        border: "1px solid rgba(128, 90, 213, 0.22)",
        shadow: "0 22px 58px rgba(80, 59, 130, 0.18)",
        heading: "#211833",
        secondary: "#6f6680",
        selectedBg: "rgba(255, 180, 92, 0.22)",
        selectedBorder: "1px solid rgba(210, 126, 34, 0.58)",
        selectedText: "#7a3f00",
        optionBg: "#ffffff",
        optionBorder: "1px solid rgba(128, 90, 213, 0.22)",
        optionText: "#2f2542",
        inputBg: "#ffffff",
        inputBorder: "1px solid rgba(128, 90, 213, 0.26)",
        inputText: "#241a35",
        cancelBg: "#ffffff",
        cancelBorder: "1px solid rgba(128, 90, 213, 0.28)",
        cancelText: "#3a2b55",
        confirmBg: "rgba(255, 180, 92, 0.22)",
        confirmBorder: "rgba(210, 126, 34, 0.5)",
        confirmText: "#7a3f00",
      }
    : {
        overlay: "rgba(4, 3, 9, 0.72)",
        cardBg: panel.background,
        border: panel.border,
        shadow: "0 28px 80px rgba(0,0,0,0.45)",
        heading: "#f5f1ff",
        secondary: "#8d86aa",
        selectedBg: "rgba(255, 180, 92, 0.16)",
        selectedBorder: "1px solid rgba(255, 180, 92, 0.72)",
        selectedText: "#ffcf8a",
        optionBg: "rgba(255,255,255,0.03)",
        optionBorder: "1px solid rgba(166, 108, 255, 0.28)",
        optionText: "#f5f1ff",
        inputBg: fieldBase.background,
        inputBorder: fieldBase.border,
        inputText: fieldBase.color,
        cancelBg: modalButton.background,
        cancelBorder: modalButton.border,
        cancelText: modalButton.color,
        confirmBg: "rgba(255, 180, 92, 0.16)",
        confirmBorder: "rgba(255, 180, 92, 0.48)",
        confirmText: "#ffcf8a",
      };

  return (
    <div className="crm-theme-root" data-theme={theme} style={shell}>
      <style>
        {`
          @keyframes spinStar {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes pulseBadge {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(185, 140, 255, 0.48); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(185, 140, 255, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(185, 140, 255, 0); }
          }

          .crm-input:focus,
          .crm-select:focus,
          .crm-textarea:focus {
            border-color: #a56aff;
            box-shadow: 0 0 0 3px rgba(165, 106, 255, 0.18), 0 0 18px rgba(165, 106, 255, 0.16);
          }

          .crm-select option {
            background: #18162a;
            color: #f4f1ff;
          }

          .logout-btn:hover {
            color: #ff7a85 !important;
          }

          .agent-shell-grid {
            display: grid;
            grid-template-columns: 364px minmax(0, 1fr);
            min-height: 100vh;
          }

          .agent-summary-grid {
            grid-template-columns: repeat(4, minmax(180px, 1fr));
          }

          .agent-form-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .agent-call-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .history-filter-grid {
            display: grid;
            grid-template-columns: 1.2fr repeat(3, minmax(160px, 1fr)) 120px;
            gap: 14px;
          }

          .history-table-wrap {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .history-edit-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .break-reason-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          @media (max-width: 1180px) {
            .agent-shell-grid {
              grid-template-columns: 1fr;
            }

            .agent-sidebar {
              position: static;
            }

            .agent-summary-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .agent-form-grid,
            .agent-call-grid,
            .history-filter-grid,
            .history-edit-grid,
            .break-reason-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 720px) {
            .agent-main {
              padding: 22px 16px !important;
            }

            .agent-summary-grid,
            .agent-form-grid,
            .agent-call-grid,
            .history-filter-grid,
            .history-edit-grid,
            .break-reason-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <div
        className="agent-shell-grid"
        style={{
        }}
      >
        <aside
          className="agent-sidebar"
          style={{
            background: "linear-gradient(180deg, rgba(12,11,25,0.98) 0%, rgba(9,8,18,0.98) 100%)",
            borderRight: "1px solid rgba(114, 74, 246, 0.24)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "36px 34px 30px", borderBottom: "1px solid rgba(114, 74, 246, 0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "rgba(122, 73, 255, 0.16)",
                    border: "1px solid rgba(166, 108, 255, 0.34)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ animation: "spinStar 10s linear infinite", display: "inline-flex" }}>
                    {aiStar}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "22px", fontWeight: 500 }}>Dialflow.ai</div>
                  <div style={{ marginTop: "6px", fontSize: "15px", color: "#a69ec3" }}>
                    Powered by Dhritii.ai
                  </div>
                </div>
              </div>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </div>

          <div style={{ padding: "28px" }}>
            <div style={{ ...panel, padding: "22px", background: "rgba(33, 20, 58, 0.6)" }}>
              <div
                style={{
                  width: "62px",
                  height: "62px",
                  borderRadius: "999px",
                  background: "linear-gradient(135deg, #c56eff 0%, #8b48ff 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  marginBottom: "18px",
                }}
              >
                {user.name?.slice(0, 2).toUpperCase() || "AG"}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 500 }}>{user.name}</div>
              <div style={{ marginTop: "8px", fontSize: "16px", color: "#aba3c5" }}>
                {user.employeeId} | {user.zohoId}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "18px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "7px 14px",
                    borderRadius: "999px",
                    background: isPaused ? "rgba(255, 165, 0, 0.14)" : "rgba(53, 229, 167, 0.14)",
                    border: isPaused ? "1px solid rgba(255, 165, 0, 0.34)" : "1px solid rgba(53, 229, 167, 0.34)",
                    color: isPaused ? "#ffa500" : "#35e5a7",
                  }}
                >
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "999px",
                      background: isPaused ? "#ffa500" : "#35e5a7",
                      animation: isPaused ? "none" : "pulseBadge 1.8s infinite",
                    }}
                  />
                  {isPaused ? " On break" : "Online"}
                </div>

                <div 
                  onClick={handleTogglePause}
                  style={{
                    width: "40px",
                    height: "20px",
                    background: isPaused ? "rgba(255, 165, 0, 0.2)" : "rgba(53, 229, 167, 0.2)",
                    borderRadius: "999px",
                    position: "relative",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  title={isPaused ? "Go Online" : "Start Break"}
                >
                  <div 
                    style={{
                      width: "14px",
                      height: "14px",
                      background: isPaused ? "#ffa500" : "#35e5a7",
                      borderRadius: "50%",
                      position: "absolute",
                      top: "3px",
                      left: isPaused ? "3px" : "23px",
                      transition: "all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                    }}
                  />
                </div>
              </div>
              {isPaused && displayedSession.breakReason ? (
                <div style={{ marginTop: "12px", color: "#ffcf8a", fontSize: "14px", lineHeight: 1.4 }}>
                  {displayedSession.breakReason}
                  {displayedSession.breakRemark ? (
                    <span style={{ color: "#8f86ac" }}> | {displayedSession.breakRemark}</span>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (hasBlockingDowntimeRequest) {
                    setFeedback("You already have an active downtime request.");
                    return;
                  }

                  setIsDowntimeModalOpen(true);
                }}
                disabled={hasBlockingDowntimeRequest}
                style={{
                  ...modalButton,
                  width: "100%",
                  marginTop: "16px",
                  border: "1px solid rgba(39, 216, 255, 0.36)",
                  background: "rgba(39, 216, 255, 0.12)",
                  color: "#9bdcff",
                  opacity: hasBlockingDowntimeRequest ? 0.55 : 1,
                  cursor: hasBlockingDowntimeRequest ? "not-allowed" : "pointer",
                }}
              >
                System Issue
              </button>
            </div>
          </div>

          <div style={{ padding: "18px 34px 10px", fontSize: "14px", color: "#726a91", letterSpacing: "0.06em" }}>
            NAVIGATION
          </div>

          <nav style={{ paddingTop: "6px" }}>
            {sidebarMenu.map((item) => (
              <div
                key={item.label}
                className={activeView === item.id ? "crm-nav-item is-active" : "crm-nav-item"}
                onClick={() => setActiveView(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "16px 34px",
                  fontSize: "18px",
                  color: activeView === item.id ? "#daafff" : "#b9b1d2",
                  background: activeView === item.id ? "rgba(122, 73, 255, 0.18)" : "transparent",
                  borderLeft: activeView === item.id ? "4px solid #c56eff" : "4px solid transparent",
                  cursor: "pointer",
                }}
              >
                {iconFor(item.icon)}
                <span>{item.label}</span>
              </div>
            ))}
          </nav>

          <div 
            onClick={openLogoutConfirmation}
            style={{ marginTop: "auto", padding: "28px 34px 30px", color: "#8b83aa", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}
            className="logout-btn"
          >
            {iconFor("logout")}
            Logout
          </div>
        </aside>

        <main className="agent-main" style={{ padding: "34px 40px 34px" }}>
          {activeView === "ranking" ? (
            <AgentRanking token={token} employeeId={user.employeeId} />
          ) : activeView === "history" ? (
            <section style={{ ...panel, padding: "30px 34px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600 }}>My history</h1>
                  <div style={{ marginTop: "8px", fontSize: "16px", color: "#b9b2d3" }}>
                    Today, yesterday, and older call responses
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView("dashboard")}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: "1px solid rgba(166, 108, 255, 0.34)",
                    background: "rgba(122, 73, 255, 0.14)",
                    color: "#f5f1ff",
                    cursor: "pointer",
                  }}
                >
                  Back to dashboard
                </button>
              </div>

              <div className="history-filter-grid" style={{ marginTop: "24px" }}>
                <input
                  className="crm-input"
                  style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                  placeholder="Search Reference ID"
                  value={historyFilters.referenceId}
                  onChange={(event) => {
                    setHistoryFilters((current) => ({ ...current, referenceId: event.target.value }));
                    setHistoryPagination((current) => ({ ...current, page: 1 }));
                  }}
                />
                <input
                  className="crm-input"
                  type="date"
                  style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                  value={historyFilters.date}
                  onChange={(event) => {
                    setHistoryFilters((current) => ({ ...current, date: event.target.value }));
                    setHistoryPagination((current) => ({ ...current, page: 1 }));
                  }}
                />
                <select
                  className="crm-select"
                  style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                  value={historyFilters.callStatus}
                  onChange={(event) => {
                    setHistoryFilters((current) => ({ ...current, callStatus: event.target.value }));
                    setHistoryPagination((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="all">All statuses</option>
                  {callStatusOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select
                  className="crm-select"
                  style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                  value={historyFilters.disposition}
                  onChange={(event) => {
                    setHistoryFilters((current) => ({ ...current, disposition: event.target.value }));
                    setHistoryPagination((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <option value="all">All dispositions</option>
                  {dispositionOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select
                  className="crm-select"
                  style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                  value={historyPagination.pageSize}
                  onChange={(event) => {
                    setHistoryPagination((current) => ({
                      ...current,
                      page: 1,
                      pageSize: Number(event.target.value),
                    }));
                  }}
                >
                  {[10, 25, 50].map((size) => (
                    <option key={size} value={size}>{size} rows</option>
                  ))}
                </select>
              </div>

              <div className="history-table-wrap" style={{ marginTop: "24px" }}>
                <table style={{ width: "100%", minWidth: "1040px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#8d86aa", textAlign: "left", fontSize: "14px" }}>
                      {[
                        "Date",
                        "Reference ID",
                        "Zoho ID",
                        "Dialer ID",
                        "Status",
                        "Disposition",
                        "Sub-Disposition",
                        "Language",
                        "Action",
                      ].map((heading) => (
                        <th key={heading} style={{ padding: "14px 12px", borderBottom: "1px solid rgba(114, 74, 246, 0.22)" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td colSpan="9" style={{ padding: "28px 12px", color: "#a9a1c3", textAlign: "center" }}>
                          Loading history...
                        </td>
                      </tr>
                    ) : historyRowsWithSections.length ? (
                      historyRowsWithSections.map((item) => {
                        if (item.type === "section") {
                          return (
                            <tr key={item.id}>
                              <td colSpan="9" style={{ padding: "18px 12px 10px", color: "#d9b7ff", fontWeight: 700, borderBottom: "1px solid rgba(114, 74, 246, 0.16)" }}>
                                {item.label}
                              </td>
                            </tr>
                          );
                        }

                        const status = normalizeCallStatus(item.call_status);
                        const tone = statusTone(status);

                        return (
                          <tr key={item.id || item.reference_id} style={{ borderBottom: "1px solid rgba(114, 74, 246, 0.16)" }}>
                            <td style={{ padding: "16px 12px", color: "#c8c1df" }}>
                              {item.created_at ? new Date(item.created_at).toLocaleString() : "NA"}
                            </td>
                            <td style={{ padding: "16px 12px" }}>{item.reference_id || "NA"}</td>
                            <td style={{ padding: "16px 12px" }}>{item.zoho_id || "NA"}</td>
                            <td style={{ padding: "16px 12px" }}>{item.dialer_id || "NA"}</td>
                            <td style={{ padding: "16px 12px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  padding: "7px 12px",
                                  borderRadius: "999px",
                                  background: tone.bg,
                                  color: tone.color,
                                }}
                              >
                                {status}
                              </span>
                            </td>
                            <td style={{ padding: "16px 12px" }}>{item.disposition || "NA"}</td>
                            <td style={{ padding: "16px 12px" }}>{item.sub_disposition || "NA"}</td>
                            <td style={{ padding: "16px 12px" }}>
                              {item.language === "Other" ? item.language_other || "Other" : item.language || "NA"}
                            </td>
                            <td style={{ padding: "16px 12px" }}>
                              {item.is_editable ? (
                                <button
                                  type="button"
                                  onClick={() => openHistoryEdit(item)}
                                  style={{
                                    padding: "7px 13px",
                                    borderRadius: "10px",
                                    border: "1px solid rgba(166, 108, 255, 0.34)",
                                    background: "rgba(122, 73, 255, 0.14)",
                                    color: "#f5f1ff",
                                    cursor: "pointer",
                                  }}
                                >
                                  Edit
                                </button>
                              ) : (
                                <span style={{ color: "#716b88" }}>Locked</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ padding: "28px 12px", color: "#a9a1c3", textAlign: "center" }}>
                          No history found yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "14px",
                  flexWrap: "wrap",
                  color: "#a9a1c3",
                }}
              >
                <div>
                  Page {historyPagination.page} of {historyPagination.totalPages} | {historyPagination.total} records
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    disabled={historyPagination.page <= 1}
                    onClick={() => setHistoryPagination((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid rgba(166, 108, 255, 0.34)",
                      background: historyPagination.page <= 1 ? "rgba(255,255,255,0.04)" : "rgba(122, 73, 255, 0.14)",
                      color: "#f5f1ff",
                      cursor: historyPagination.page <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={historyPagination.page >= historyPagination.totalPages}
                    onClick={() =>
                      setHistoryPagination((current) => ({
                        ...current,
                        page: Math.min(current.page + 1, current.totalPages),
                      }))
                    }
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid rgba(166, 108, 255, 0.34)",
                      background: historyPagination.page >= historyPagination.totalPages ? "rgba(255,255,255,0.04)" : "rgba(122, 73, 255, 0.14)",
                      color: "#f5f1ff",
                      cursor: historyPagination.page >= historyPagination.totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          ) : activeView === "profile" ? (
            <section style={{ ...panel, padding: "30px 34px" }}>
              <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600 }}>My profile</h1>
              <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" }}>
                {[
                  ["Employee ID", user.employeeId],
                  ["Employee Name", user.name],
                  ["Role", user.role],
                  ["Zoho ID", zohoId || "NA"],
                  ["Dialer ID", dialerId || "NA"],
                ].map(([label, value]) => (
                  <div key={label} style={{ ...panel, padding: "18px", background: "rgba(10, 9, 20, 0.42)" }}>
                    <div style={{ color: "#8d86aa", fontSize: "14px" }}>{label}</div>
                    <div style={{ marginTop: "8px", fontSize: "19px" }}>{value}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600 }}>Agent Dashboard</h1>
              <div style={{ marginTop: "8px", fontSize: "16px", color: "#b9b2d3" }}>
                {formatDateTime(currentTime)}
              </div>
            </div>

            <div
              style={{
                padding: "10px 18px",
                borderRadius: "999px",
                background: "rgba(122, 73, 255, 0.14)",
                border: "1px solid rgba(166, 108, 255, 0.34)",
                color: "#d6b2ff",
                fontSize: "16px",
              }}
            >
              Login: {formatTime(sessionLoginTime)} | Staff Time: {formatDuration(visualStaffTimeToday)}
            </div>
          </div>

          {currentDowntimeRequest ? (
            <section
              style={{
                ...panel,
                marginTop: "24px",
                padding: "24px 26px",
                borderColor: currentDowntimeTone.border,
                background: `linear-gradient(180deg, ${currentDowntimeTone.bg}, rgba(19, 18, 37, 0.96))`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#9da6c3", fontSize: "14px", letterSpacing: "0.06em" }}>DOWNTIME REQUEST STATUS</div>
                  <h2 style={{ margin: "10px 0 0", fontSize: "24px", color: currentDowntimeTone.color }}>
                    {downtimeStatusLabel(currentDowntimeStatus)}
                  </h2>
                </div>
                <div
                  style={{
                    padding: "10px 16px",
                    borderRadius: "999px",
                    border: `1px solid ${currentDowntimeTone.border}`,
                    background: currentDowntimeTone.bg,
                    color: currentDowntimeTone.color,
                    fontSize: "18px",
                    fontWeight: 800,
                  }}
                >
                  {currentDowntimeStatus === "approved" ? `Running ${formatDuration(currentDowntimeDuration)}` : currentDowntimeStatus === "resolved" ? `Final ${formatDuration(currentDowntimeDuration)}` : downtimeStatusLabel(currentDowntimeStatus)}
                </div>
              </div>

              <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
                {[
                  ["Issue Type", currentDowntimeRequest.issueType],
                  ["Requested Time", formatStatusDateTime(currentDowntimeRequest.requestedAt)],
                  ["Approved By", currentDowntimeRequest.approvedByName || "NA"],
                  ["Approved Time", formatStatusDateTime(currentDowntimeRequest.approvedAt)],
                  [
                    currentDowntimeStatus === "resolved" ? "Final Duration" : "Running Duration",
                    currentDowntimeStatus === "pending" || currentDowntimeStatus === "rejected" ? "NA" : formatDuration(currentDowntimeDuration),
                  ],
                  ["Comment", currentDowntimeRequest.comment || "NA"],
                ].map(([label, value]) => (
                  <div key={label} style={{ border: "1px solid rgba(122, 73, 255, 0.18)", borderRadius: "14px", padding: "14px", background: "rgba(10, 9, 20, 0.35)", minWidth: 0 }}>
                    <div style={{ color: "#8d86aa", fontSize: "13px" }}>{label}</div>
                    <div style={{ marginTop: "8px", color: "#f5f1ff", fontSize: "16px", lineHeight: 1.35, overflowWrap: "anywhere" }}>{value}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section
            className="agent-summary-grid"
            style={{
              marginTop: "28px",
              display: "grid",
              gap: "18px",
            }}
          >
            {[
              { title: "TODAY'S CALLS", value: summary.totalCalls, note: "Current day only", accent: "#c387ff" },
              {
                title: "TODAY'S CONNECTED",
                value: summary.connectedCalls,
                note: `${summary.totalCalls ? Math.round((summary.connectedCalls / summary.totalCalls) * 100) : 0}% connect rate`,
                accent: "#34d5ff",
              },
              { title: "NOT CONNECTED", value: summary.notConnectedCalls, note: "Current day only", accent: "#ff7a85" },
              {
                title: "TODAY'S POSITIVE",
                value: summary.positiveCalls,
                note: `${summary.connectedCalls ? Math.round((summary.positiveCalls / summary.connectedCalls) * 100) : 0}% conversion`,
                accent: "#54ebb2",
              },
              { title: "STAFF TIME", value: formatDuration(visualStaffTimeToday), note: `9h shift target\nLogin ${formatTime(sessionLoginTime)}`, accent: "#9bdcff" },
              { title: "TOTAL LOGIN TIME", value: formatDuration(visualTotalLoginDurationToday), note: "Server-calculated time", accent: "#54ebb2" },
              { title: "BREAK TIME", value: formatDuration(visualTotalBreakDurationToday), note: currentBreakStatus === "break" ? `Current ${formatDuration(visualCurrentBreakDuration)}` : "Server total", accent: "#ffa500" },
              { title: "BREAK COUNT TODAY", value: displayedSession.breakCountToday, note: `${displayedSession.activeSessionCount || 0} active session${displayedSession.activeSessionCount === 1 ? "" : "s"}`, accent: "#ff7a85" },
            ].map((item) => (
              <article style={{ ...panel, padding: "22px 24px" }} key={item.title}>
                <div style={{ fontSize: "16px", color: "#a9a1c3", lineHeight: 1.1, maxWidth: "120px" }}>
                  {item.title}
                </div>
                <div style={{ marginTop: "18px", fontSize: typeof item.value === "string" ? "34px" : "52px", lineHeight: 1, color: item.accent }}>
                  {item.value}
                </div>
                <div style={{ marginTop: "16px", color: "#787196", fontSize: "16px", whiteSpace: "pre-line" }}>
                  {item.note}
                </div>
              </article>
            ))}
          </section>

          <section style={{ ...panel, marginTop: "34px", padding: "34px 36px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "22px", fontWeight: 500 }}>New call response</div>
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "1px solid rgba(166, 108, 255, 0.34)",
                  color: "#d9b7ff",
                  background: "rgba(122, 73, 255, 0.12)",
                  fontSize: "16px",
                }}
              >
                Required *
              </div>
            </div>

            <div style={{ marginTop: "20px", borderTop: "1px solid rgba(114, 74, 246, 0.22)" }} />
            <div style={{ marginTop: "34px", borderTop: "1px solid rgba(114, 74, 246, 0.22)" }} />
            <div style={{ marginTop: "14px", fontSize: "15px", color: "#615b7d", letterSpacing: "0.05em" }}>
              AGENT INFO (AUTO-FILLED)
            </div>

            <div
              className="agent-form-grid"
              style={{
                marginTop: "18px",
                display: "grid",
                gap: "20px",
              }}
            >
              <div>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>EMPLOYEE ID</div>
                <div style={{ ...fieldBase, display: "flex", alignItems: "center", gap: "10px", color: "#666078" }}>
                  {lockIcon}
                  <span>{user.employeeId}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>DIALER ID</div>
                <input
                  className="crm-input"
                  style={fieldBase}
                  placeholder="Enter dialer ID"
                  value={dialerId}
                  onChange={(event) => setDialerId(event.target.value)}
                />
              </div>

              <div>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>EMPLOYEE NAME</div>
                <div style={{ ...fieldBase, display: "flex", alignItems: "center", gap: "10px", color: "#666078" }}>
                  {lockIcon}
                  <span>{user.name}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>ZOHO ID</div>
                <input
                  className="crm-input"
                  style={fieldBase}
                  placeholder="Enter Zoho ID"
                  value={zohoId}
                  onChange={(event) => setZohoId(event.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: "28px", borderTop: "1px solid rgba(114, 74, 246, 0.22)" }} />
            <div style={{ marginTop: "14px", fontSize: "15px", color: "#615b7d", letterSpacing: "0.05em" }}>
              CALL DETAILS
            </div>

            <div
              className="agent-call-grid"
              style={{
                marginTop: "18px",
                display: "grid",
                gap: "20px",
              }}
            >
              <div>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>REFERENCE ID *</div>
                <input
                  className="crm-input"
                  style={fieldBase}
                  placeholder="e.g. LBMT2026041513742628"
                  value={referenceId}
                  onChange={(event) => setReferenceId(event.target.value)}
                />
              </div>

              <div>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>CALL STATUS *</div>
                <select
                  className="crm-select"
                  style={fieldBase}
                  value={callStatus}
                  onChange={(event) => {
                    setCallStatus(event.target.value);
                    setSubDisposition("NA");
                  }}
                >
                  {callStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>LANGUAGE</div>
                <select
                  className="crm-select"
                  style={fieldBase}
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  {languageOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showOtherCallStatus ? (
              <div style={{ marginTop: "18px", maxWidth: "360px" }}>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>OTHER CALL STATUS</div>
                <input
                  className="crm-input"
                  style={fieldBase}
                  placeholder="Enter call status"
                  value={callStatusOther}
                  onChange={(event) => setCallStatusOther(event.target.value)}
                />
              </div>
            ) : null}

            {showOtherLanguage ? (
              <div style={{ marginTop: "18px", maxWidth: "360px" }}>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>OTHER LANGUAGE</div>
                <input
                  className="crm-input"
                  style={fieldBase}
                  placeholder="Enter language"
                  value={languageOther}
                  onChange={(event) => setLanguageOther(event.target.value)}
                />
              </div>
            ) : null}

            <div style={{ marginTop: "28px", borderTop: "1px solid rgba(114, 74, 246, 0.22)" }} />
            <div style={{ marginTop: "14px", fontSize: "15px", color: "#615b7d", letterSpacing: "0.05em" }}>
              DISPOSITION
            </div>

            {showDisposition ? (
              <div style={{ marginTop: "18px", maxWidth: "480px" }}>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>DISPOSITION *</div>
                <select
                  className="crm-select"
                  style={fieldBase}
                  value={disposition}
                  onChange={(event) => {
                    setDisposition(event.target.value);
                    setSubDisposition("NA");
                  }}
                >
                  {dispositionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {showDisposition && showOtherDisposition ? (
              <div style={{ marginTop: "18px", maxWidth: "480px" }}>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>OTHER DISPOSITION</div>
                <input
                  className="crm-input"
                  style={fieldBase}
                  placeholder="Enter disposition"
                  value={dispositionOther}
                  onChange={(event) => setDispositionOther(event.target.value)}
                />
              </div>
            ) : null}

            {showDisposition && showSubDisposition ? (
              <div style={{ marginTop: "18px", maxWidth: "480px" }}>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>SUB-DISPOSITION</div>
                <select
                  className="crm-select"
                  style={fieldBase}
                  value={subDisposition}
                  onChange={(event) => setSubDisposition(event.target.value)}
                >
                  {subDispositionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {showDisposition && showSubDisposition && showOtherSubDisposition ? (
              <div style={{ marginTop: "18px", maxWidth: "480px" }}>
                <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>
                  OTHER SUB-DISPOSITION
                </div>
                <input
                  className="crm-input"
                  style={fieldBase}
                  placeholder="Enter sub-disposition"
                  value={subDispositionOther}
                  onChange={(event) => setSubDispositionOther(event.target.value)}
                />
              </div>
            ) : null}

            {feedback ? (
              <div style={{ marginTop: "14px", color: "#d9b7ff", fontSize: "15px" }}>{feedback}</div>
            ) : null}

            <div style={{ marginTop: "28px", borderTop: "1px solid rgba(114, 74, 246, 0.22)" }} />
            <div
              style={{
                marginTop: "26px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
             
              <button
                type="button"
                onClick={handleSubmit}
                style={{
                  padding: "16px 28px",
                  borderRadius: "16px",
                  border: "1px solid rgba(158, 149, 184, 0.34)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#f5f1ff",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                {submitting ? "Submitting..." : "Submit response"}
              </button>
            </div>
          </section>

          <section style={{ ...panel, marginTop: "36px", padding: "28px 36px 24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "22px", fontWeight: 500 }}>Recent submissions</div>
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "1px solid rgba(166, 108, 255, 0.34)",
                  color: "#d9b7ff",
                  background: "rgba(122, 73, 255, 0.12)",
                  fontSize: "16px",
                }}
              >
                Today | {summary.totalCalls} total
              </div>
            </div>

            <div style={{ marginTop: "20px", borderTop: "1px solid rgba(114, 74, 246, 0.22)" }} />

            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.2fr 1.3fr 1.4fr",
                  gap: "16px",
                  padding: "12px 14px",
                  color: "#726a91",
                  fontSize: "15px",
                  letterSpacing: "0.05em",
                }}
              >
                <div>REF ID</div>
                <div>STATUS</div>
                <div>DISPOSITION</div>
                <div>SUB-DISPOSITION</div>
              </div>

              {rows.map((item) => {
                const tone = statusTone(item.status);

                return (
                  <div
                    key={`${item.refId}-${item.disposition}-${item.subDisposition}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1.2fr 1.3fr 1.4fr",
                      gap: "16px",
                      padding: "18px 14px",
                      borderTop: "1px solid rgba(114, 74, 246, 0.18)",
                      alignItems: "center",
                      fontSize: "17px",
                    }}
                  >
                    <div>{item.refId}</div>
                    <div>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "8px 16px",
                          borderRadius: "999px",
                          background: tone.bg,
                          color: tone.color,
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div>{item.disposition}</div>
                    <div>{item.subDisposition}</div>
                  </div>
                );
              })}
            </div>
          </section>
            </>
          )}
        </main>
      </div>

      {isBreakModalOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: "18px", background: breakModalTheme.overlay }}>
          <div
            style={{
              ...panel,
              width: "100%",
              maxWidth: "460px",
              padding: "26px",
              background: breakModalTheme.cardBg,
              border: breakModalTheme.border,
              boxShadow: breakModalTheme.shadow,
            }}
          >
            <h2 style={{ margin: 0, fontSize: "22px", color: breakModalTheme.heading }}>Start Break</h2>
            <div style={{ marginTop: "10px", color: breakModalTheme.secondary, fontSize: "14px", lineHeight: 1.45 }}>
              Select a reason before your break timer starts.
            </div>

            <div className="break-reason-grid" style={{ marginTop: "20px" }}>
              {breakReasonOptions.map((option) => {
                const selected = breakReason === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setBreakReason(option);
                      if (!breakReasonsWithRemark.has(option)) {
                        setBreakRemark("");
                      }
                    }}
                    style={{
                      padding: "14px 15px",
                      borderRadius: "14px",
                      border: selected ? breakModalTheme.selectedBorder : breakModalTheme.optionBorder,
                      background: selected ? breakModalTheme.selectedBg : breakModalTheme.optionBg,
                      color: selected ? breakModalTheme.selectedText : breakModalTheme.optionText,
                      cursor: "pointer",
                      fontSize: "15px",
                      fontWeight: 700,
                      textAlign: "left",
                      boxShadow: selected && isLightTheme ? "0 8px 18px rgba(210, 126, 34, 0.12)" : "none",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {breakReasonsWithRemark.has(breakReason) ? (
              <textarea
                className="crm-textarea"
                style={{
                  ...fieldBase,
                  marginTop: "16px",
                  minHeight: "100px",
                  resize: "none",
                  fontSize: "15px",
                  padding: "13px 14px",
                  background: breakModalTheme.inputBg,
                  border: breakModalTheme.inputBorder,
                  color: breakModalTheme.inputText,
                }}
                placeholder="Session details"
                value={breakRemark}
                maxLength={500}
                onChange={(event) => setBreakRemark(event.target.value)}
              />
            ) : null}

            <div style={{ marginTop: "22px", display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeBreakModal}
                disabled={breakSaving}
                style={{
                  ...modalButton,
                  background: breakModalTheme.cancelBg,
                  border: breakModalTheme.cancelBorder,
                  color: breakModalTheme.cancelText,
                  opacity: breakSaving ? 0.55 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBreak}
                disabled={breakSaving}
                style={{
                  ...modalButton,
                  background: breakModalTheme.confirmBg,
                  borderColor: breakModalTheme.confirmBorder,
                  color: breakModalTheme.confirmText,
                  opacity: breakSaving ? 0.55 : 1,
                }}
              >
                {breakSaving ? "Starting..." : "Confirm Break"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDowntimeModalOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: "18px", background: breakModalTheme.overlay }}>
          <div
            style={{
              ...panel,
              width: "100%",
              maxWidth: "500px",
              padding: "26px",
              background: breakModalTheme.cardBg,
              border: "1px solid rgba(39, 216, 255, 0.36)",
              boxShadow: breakModalTheme.shadow,
            }}
          >
            <h2 style={{ margin: 0, fontSize: "22px", color: breakModalTheme.heading }}>System Issue</h2>
            <div style={{ marginTop: "10px", color: breakModalTheme.secondary, fontSize: "14px", lineHeight: 1.45 }}>
              Submit a downtime request for admin approval. Downtime starts only after approval.
            </div>

            <div style={{ marginTop: "20px", display: "grid", gap: "14px" }}>
              <select
                className="crm-select"
                style={{
                  ...fieldBase,
                  background: breakModalTheme.inputBg,
                  border: breakModalTheme.inputBorder,
                  color: breakModalTheme.inputText,
                }}
                value={downtimeIssueType}
                onChange={(event) => setDowntimeIssueType(event.target.value)}
              >
                {downtimeIssueTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <textarea
                className="crm-textarea"
                style={{
                  ...fieldBase,
                  minHeight: "120px",
                  resize: "none",
                  fontSize: "15px",
                  padding: "13px 14px",
                  background: breakModalTheme.inputBg,
                  border: breakModalTheme.inputBorder,
                  color: breakModalTheme.inputText,
                }}
                placeholder="Internet disconnected due to ISP outage."
                value={downtimeComment}
                maxLength={600}
                onChange={(event) => setDowntimeComment(event.target.value)}
              />
            </div>

            <div style={{ marginTop: "22px", display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeDowntimeModal}
                disabled={downtimeSaving}
                style={{
                  ...modalButton,
                  background: breakModalTheme.cancelBg,
                  border: breakModalTheme.cancelBorder,
                  color: breakModalTheme.cancelText,
                  opacity: downtimeSaving ? 0.55 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDowntimeRequest}
                disabled={downtimeSaving || hasBlockingDowntimeRequest}
                style={{
                  ...modalButton,
                  background: "rgba(39, 216, 255, 0.18)",
                  borderColor: "rgba(39, 216, 255, 0.5)",
                  color: "#9bdcff",
                  opacity: downtimeSaving || hasBlockingDowntimeRequest ? 0.55 : 1,
                }}
              >
                {downtimeSaving ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLogoutConfirmationOpen ? (
        <LogoutConfirmationModal onCancel={closeLogoutConfirmation} onConfirm={handleLogout} isLoggingOut={isLoggingOut} />
      ) : null}

      {historyEditTarget ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: "20px", background: "rgba(4, 3, 9, 0.72)" }}>
          <form onSubmit={handleHistoryEditSave} style={{ ...panel, width: "100%", maxWidth: "620px", padding: "26px", display: "grid", gap: "14px", boxShadow: "0 28px 80px rgba(0,0,0,0.45)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "22px" }}>Edit history entry</h2>
              <div style={{ marginTop: "8px", color: "#8d86aa", fontSize: "14px" }}>
                {historyEditTarget.reference_id || `REF-${historyEditTarget.id}`}
              </div>
            </div>

            <div className="history-edit-grid">
              <select
                className="crm-select"
                style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                value={historyEditForm.callStatus}
                onChange={(event) => setHistoryEditForm((current) => ({ ...current, callStatus: event.target.value }))}
              >
                {callStatusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                className="crm-select"
                style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                value={historyEditForm.disposition}
                onChange={(event) =>
                  setHistoryEditForm((current) => ({
                    ...current,
                    disposition: event.target.value,
                    subDisposition: subDispositionMap[event.target.value] ? "NA" : "NA",
                  }))
                }
              >
                {dispositionOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                className="crm-select"
                disabled={!historyEditShowSubDisposition}
                style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px", opacity: historyEditShowSubDisposition ? 1 : 0.62 }}
                value={historyEditShowSubDisposition ? historyEditForm.subDisposition : "NA"}
                onChange={(event) => setHistoryEditForm((current) => ({ ...current, subDisposition: event.target.value }))}
              >
                {historyEditSubDispositionOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                className="crm-select"
                style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                value={historyEditForm.language}
                onChange={(event) => setHistoryEditForm((current) => ({ ...current, language: event.target.value }))}
              >
                {languageOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {historyEditShowOtherLanguage ? (
              <input
                className="crm-input"
                style={{ ...fieldBase, fontSize: "15px", padding: "12px 14px" }}
                placeholder="Enter language"
                value={historyEditForm.languageOther}
                onChange={(event) => setHistoryEditForm((current) => ({ ...current, languageOther: event.target.value }))}
              />
            ) : null}

            {feedback ? <div style={{ color: feedback.toLowerCase().includes("success") ? "#54ebb2" : "#ff9aa7", fontSize: "14px" }}>{feedback}</div> : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeHistoryEdit}
                disabled={historyEditSaving}
                style={{ ...modalButton, opacity: historyEditSaving ? 0.55 : 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={historyEditSaving}
                style={{ ...modalButton, background: "rgba(122, 73, 255, 0.18)", borderColor: "rgba(166, 108, 255, 0.42)", opacity: historyEditSaving ? 0.55 : 1 }}
              >
                {historyEditSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard;
               
