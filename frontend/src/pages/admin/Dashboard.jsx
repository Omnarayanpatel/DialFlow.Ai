import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import LogoutConfirmationModal from "../../components/common/LogoutConfirmationModal";
import ThemeToggle from "../../components/common/ThemeToggle";
import AdminRanking from "../../components/ranking/AdminRanking";
import { deleteAgent, forceLogoutAgent, forceLogoutAllAgents, getAgentMonitoring, registerUser, updateAgent } from "../../services/authService";
import { downloadResponsesExport, downloadTimeReportExport, getAllResponses, getTimeReport } from "../../services/responseService";
import { getAdminLeaderboard } from "../../services/rankingService";
import { createDowntimeSocket } from "../../services/socketService";
import {
  approveDowntimeRequest,
  getDowntimeHistory,
  getDowntimeReport,
  getDowntimeRequests,
  rejectDowntimeRequest,
  resolveDowntimeRequest,
} from "../../services/downtimeService";
import {
  createAuditLog,
  createManagedAdmin,
  deleteManagedAdmin,
  forceLogoutManagedAdmin,
  getAuditLogs,
  getManagedAdmins,
  updateManagedAdmin,
} from "../../services/superAdminService";
import { useStore } from "../../store/useStore";
import { useTheme } from "../../theme/useTheme";

const shell = {
  minHeight: "100vh",
  background: "#090812",
  color: "#f4f0ff",
  fontFamily: "Segoe UI, sans-serif",
};

const panel = {
  background: "#121027",
  border: "1px solid rgba(132, 80, 255, 0.34)",
  borderRadius: "18px",
  boxSizing: "border-box",
};

const input = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid rgba(166, 155, 124, 0.38)",
  background: "rgba(55, 55, 48, 0.9)",
  color: "#f4f0ff",
  boxSizing: "border-box",
  fontSize: "16px",
  outline: "none",
};

const ghostButton = {
  padding: "13px 20px",
  borderRadius: "12px",
  border: "1px solid rgba(154, 145, 176, 0.44)",
  background: "transparent",
  color: "#f4f0ff",
  cursor: "pointer",
  fontSize: "16px",
  fontWeight: 600,
};

const DOWNTIME_APPROVER_EMPLOYEE_IDS = new Set([
  "AM21612560",
  "AMPLTMP204",
  "AM21612448",
]);

const downtimeSocketEvents = [
  "new_downtime_request",
  "downtime_approved",
  "downtime_rejected",
  "downtime_resolved",
];

const downtimeIssueTypes = ["System Issue", "Internet Issue", "Portal Issue", "Dialer Issue", "Session"];

const formatDate = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

const iconFor = (type) => {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
  };

  if (type === "grid") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="6" height="6" rx="1.5" fill="#b06cff" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" fill="#b06cff" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" fill="#b06cff" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" fill="#b06cff" />
      </svg>
    );
  }

  if (type === "chart") {
    return (
      <svg {...common}>
        <path d="M4 17L9 12L13 15L20 7" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "user") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" stroke="#aeb5d4" strokeWidth="2" />
        <path d="M5 20C6.6 16.8 9 15.5 12 15.5C15 15.5 17.4 16.8 19 20" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "download") {
    return (
      <svg {...common}>
        <path d="M12 4V15" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 11L12 15L16 11" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 20H19" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "logout") {
    return (
      <svg {...common}>
        <path d="M10 5H6.5C5.7 5 5 5.7 5 6.5V17.5C5 18.3 5.7 19 6.5 19H10" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 8L18 12L14 16" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 12H9" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M5 7H19M5 12H15M5 17H11" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const statusTone = (status) => {
  const value = String(status || "").trim().toLowerCase();

  if (status === "Connected" || value === "online" || value === "active") {
    return { color: "#26e6ad", bg: "rgba(38, 230, 173, 0.12)", border: "rgba(38, 230, 173, 0.34)" };
  }

  if (status === "Not Connected" || value === "offline" || value === "inactive") {
    return { color: "#ff7685", bg: "rgba(255, 118, 133, 0.12)", border: "rgba(255, 118, 133, 0.34)" };
  }

  if (value === "break" || value === "on break") {
    return { color: "#ffa500", bg: "rgba(255, 165, 0, 0.12)", border: "rgba(255, 165, 0, 0.34)" };
  }

  return { color: "#ffd02d", bg: "rgba(255, 208, 45, 0.12)", border: "rgba(255, 208, 45, 0.34)" };
};

const countBy = (items, key, fallback = "NA") => {
  const counts = new Map();

  items.forEach((item) => {
    const value = item[key] || fallback;
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

const fallbackAdminSummary = {
  totalCalls: 0,
  connectedCalls: 0,
  positiveCalls: 0,
  notConnectedCalls: 0,
  activeAgents: 0,
  agentsOnBreak: 0,
};

const normalizeAgentStatus = (status) => {
  const value = String(status || "offline").trim().toLowerCase();

  if (value === "online") return "online";
  if (value === "break" || value === "on break") return "break";
  return "offline";
};

const displayAgentStatus = (status) => {
  const value = normalizeAgentStatus(status);

  if (value === "online") return "online";
  if (value === "break") return "break";
  return "offline";
};

const formatDuration = (seconds) => {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(Number(seconds), 0) : 0;
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatDurationHuman = (seconds) => {
  return formatDuration(seconds);
};

const formatDateTime = (value) => {
  if (!value) {
    return "NA";
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDateOnly = (value) => {
  if (!value) {
    return "NA";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatReportDateOnly = (value) => {
  if (!value) {
    return "NA";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date(value))
    .replace(/\//g, "-");
};

const formatTimeOnly = (value) => {
  if (!value) {
    return "NA";
  }

  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const getDowntimeDurationSeconds = (item = {}) => {
  const storedDuration = Number(item.durationSeconds || item.runningDurationSeconds || 0);

  if (storedDuration > 0) {
    return storedDuration;
  }

  const start = new Date(item.startTime || item.approvedAt).getTime();
  const end = new Date(item.endTime || item.resolvedAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / 1000);
};

const buildDowntimeSummary = (records = []) => {
  const summary = {
    total: records.length,
    pending: 0,
    approved: 0,
    resolved: 0,
    rejected: 0,
    totalSeconds: 0,
  };

  records.forEach((item) => {
    const status = String(item.status || "").toLowerCase();

    if (status === "pending") summary.pending += 1;
    if (status === "approved") summary.approved += 1;
    if (status === "resolved") summary.resolved += 1;
    if (status === "rejected") summary.rejected += 1;

    summary.totalSeconds += getDowntimeDurationSeconds(item);
  });

  return summary;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const AdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useStore();
  const { theme, toggleTheme } = useTheme();
  const isSuperAdmin = user.role === "super_admin";
  const isDowntimeApprover = DOWNTIME_APPROVER_EMPLOYEE_IDS.has(String(user.employeeId || "").trim());
  const initialView = location.pathname.includes("/manage-admins")
    ? "manage-admins"
    : location.pathname.includes("/audit-logs")
      ? "audit-logs"
      : location.pathname.includes("/downtime-history")
        ? "downtime-history"
        : "overview";
  const [activeView, setActiveView] = useState(initialView);
  const [responses, setResponses] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [adminSummary, setAdminSummary] = useState(fallbackAdminSummary);
  const [responsePagination, setResponsePagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoadingResponses, setIsLoadingResponses] = useState(true); // New state for loading
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dispositionFilter, setDispositionFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [employeeNameFilter, setEmployeeNameFilter] = useState("");
  const [referenceIdFilter, setReferenceIdFilter] = useState("");
  const [responsePage, setResponsePage] = useState(1);
  const [responsePageSize, setResponsePageSize] = useState(10);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentStatusFilter, setAgentStatusFilter] = useState("all");
  const [agentViewMode, setAgentViewMode] = useState("grid");
  const [editingAgent, setEditingAgent] = useState(null);
  const [deletingAgent, setDeletingAgent] = useState(null);
  const [forceLogoutTarget, setForceLogoutTarget] = useState(null);
  const [isLogoutConfirmationOpen, setIsLogoutConfirmationOpen] = useState(false);
  const [isAgentActionLoading, setIsAgentActionLoading] = useState(false);
  const [managedAdmins, setManagedAdmins] = useState([]);
  const [managedAdminSummary, setManagedAdminSummary] = useState({
    totalAdmins: 0,
    activeAdmins: 0,
    totalAgents: 0,
    onlineAgents: 0,
  });
  const [adminModalMode, setAdminModalMode] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({
    name: "",
    employeeId: "",
    email: "",
    password: "",
    role: "admin",
    status: "active",
  });
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState({
    startDate: "",
    endDate: "",
    admin: "all",
    action: "all",
  });
  const [downtimeRequests, setDowntimeRequests] = useState([]);
  const [isDowntimeLoading, setIsDowntimeLoading] = useState(false);
  const [downtimeActionId, setDowntimeActionId] = useState(null);
  const [downtimeNotifications, setDowntimeNotifications] = useState([]);
  const [unreadDowntimeCount, setUnreadDowntimeCount] = useState(0);
  const [editAgentForm, setEditAgentForm] = useState({
    name: "",
    employeeId: "",
    password: "",
    role: "agent",
  });
  const [reportType, setReportType] = useState("daily");
  const [reportDateFrom, setReportDateFrom] = useState("2026-04-21");
  const [reportDateTo, setReportDateTo] = useState("2026-04-28");
  const [reportAgent, setReportAgent] = useState("all");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportRecords, setReportRecords] = useState([]);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [rankingReportDateFrom, setRankingReportDateFrom] = useState("2026-04-21");
  const [rankingReportDateTo, setRankingReportDateTo] = useState("2026-04-28");
  const [rankingReportAgent, setRankingReportAgent] = useState("all");
  const [rankingReportGenerated, setRankingReportGenerated] = useState(false);
  const [rankingReportRows, setRankingReportRows] = useState([]);
  const [isRankingReportLoading, setIsRankingReportLoading] = useState(false);
  const [timeReportDateFrom, setTimeReportDateFrom] = useState("2026-04-21");
  const [timeReportDateTo, setTimeReportDateTo] = useState("2026-04-28");
  const [timeReportAgent, setTimeReportAgent] = useState("all");
  const [timeReportGenerated, setTimeReportGenerated] = useState(false);
  const [timeReportRecords, setTimeReportRecords] = useState([]);
  const [timeReportSummary, setTimeReportSummary] = useState({
    totalLoginDuration: 0,
    totalBreakDuration: 0,
    staffTimeDuration: 0,
    totalBreakCount: 0,
  });
  const [isTimeReportLoading, setIsTimeReportLoading] = useState(false);
  const [downtimeReportDateFrom, setDowntimeReportDateFrom] = useState("2026-04-21");
  const [downtimeReportDateTo, setDowntimeReportDateTo] = useState("2026-04-28");
  const [downtimeReportAgent, setDowntimeReportAgent] = useState("all");
  const [downtimeReportGenerated, setDowntimeReportGenerated] = useState(false);
  const [downtimeReportRecords, setDowntimeReportRecords] = useState([]);
  const [isDowntimeReportLoading, setIsDowntimeReportLoading] = useState(false);
  const [downtimeHistoryDateFrom, setDowntimeHistoryDateFrom] = useState("2026-04-21");
  const [downtimeHistoryDateTo, setDowntimeHistoryDateTo] = useState("2026-04-28");
  const [downtimeHistoryAgent, setDowntimeHistoryAgent] = useState("all");
  const [downtimeHistoryStatus, setDowntimeHistoryStatus] = useState("all");
  const [downtimeHistoryIssueType, setDowntimeHistoryIssueType] = useState("all");
  const [downtimeHistoryRecords, setDowntimeHistoryRecords] = useState([]);
  const [isDowntimeHistoryLoading, setIsDowntimeHistoryLoading] = useState(false);
  const [agentForm, setAgentForm] = useState({
    employeeId: "",
    name: "",
    password: "",
  });

  useEffect(() => {
    document.title = isSuperAdmin ? "Super Admin Dashboard | Dialflow.ai" : "Admin Dashboard | Dialflow.ai";
  }, [isSuperAdmin]);

  useEffect(() => {
    if (location.pathname.includes("/manage-admins")) {
      setActiveView("manage-admins");
    } else if (location.pathname.includes("/audit-logs")) {
      setActiveView("audit-logs");
    } else if (location.pathname.includes("/downtime-history")) {
      setActiveView("downtime-history");
    } else if (location.pathname === "/super-admin" || location.pathname === "/admin") {
      setActiveView("overview");
    }
  }, [location.pathname]);

  const analytics = useMemo(() => {
    const totalCalls = adminSummary.totalCalls || 0;
    const connectedCalls = adminSummary.connectedCalls || 0;
    const notConnectedCalls = adminSummary.notConnectedCalls || 0;
    const positiveCalls = adminSummary.positiveCalls || 0;
    const activeAgents = adminSummary.activeAgents || 0;
    const agentsOnBreak = adminSummary.agentsOnBreak || 0;

    return {
      totalCalls,
      connectedCalls,
      notConnectedCalls,
      positiveCalls,
      activeAgents,
      agentsOnBreak,
      connectRate: totalCalls ? Math.round((connectedCalls / totalCalls) * 100) : 0,
      conversionRate: connectedCalls ? Math.round((positiveCalls / connectedCalls) * 100) : 0,
    };
  }, [adminSummary]);

  const agents = useMemo(
    () => {
      if (allAgents.length) {
        return allAgents.map((agent) => [agent.employee_id, agent.name || agent.employee_id]);
      }

      return Array.from(
        new Map(
          responses
            .filter((item) => item.employee_id)
            .map((item) => [item.employee_id, item.employee_name || item.employee_id])
        ).entries()
      );
    },
    [allAgents, responses]
  );

  const rankingAgentOptions = useMemo(() => {
    if (allAgents.length) {
      return allAgents.map((agent) => [agent.id || agent.employee_id, agent.name || agent.employee_id]);
    }

    return agents;
  }, [agents, allAgents]);

  const downtimeHistoryAgentOptions = useMemo(() => {
    if (allAgents.length) {
      return allAgents.map((agent) => [agent.employee_id || agent.id, agent.name || agent.employee_id || agent.id]);
    }

    return agents;
  }, [agents, allAgents]);

  const pendingDowntimeRequests = useMemo(
    () => downtimeRequests.filter((request) => request.status === "pending"),
    [downtimeRequests]
  );

  const activeDowntimeRequests = useMemo(
    () => downtimeRequests.filter((request) => request.status === "approved"),
    [downtimeRequests]
  );

  const downtimeHistorySummary = useMemo(
    () => buildDowntimeSummary(downtimeHistoryRecords),
    [downtimeHistoryRecords]
  );

  const latestDowntimeNotification = downtimeNotifications[0];

  const dispositions = useMemo(
    () => Array.from(new Set(responses.map((item) => item.disposition).filter(Boolean))).sort(),
    [responses]
  );

  const filteredResponses = useMemo(() => {
    const term = search.trim().toLowerCase();

    return responses.filter((item) => {
      const matchesSearch =
        !term ||
        item.reference_id?.toLowerCase().includes(term) ||
        item.employee_name?.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || item.call_status === statusFilter;
      const matchesDisposition = dispositionFilter === "all" || item.disposition === dispositionFilter;
      const matchesAgent = agentFilter === "all" || item.employee_id === agentFilter;
      const matchesLanguage = languageFilter === "all" || item.language === languageFilter;

      return matchesSearch && matchesStatus && matchesDisposition && matchesAgent && matchesLanguage;
    });
  }, [agentFilter, dispositionFilter, languageFilter, responses, search, statusFilter]);

  const agentPerformance = useMemo(() => {
    const counts = new Map();

    responses.forEach((item) => {
      const key = item.employee_id || "NA";
      const current = counts.get(key) || {
        name: item.employee_name || key,
        total: 0,
      };

      counts.set(key, {
        ...current,
        total: current.total + 1,
      });
    });

    return Array.from(counts.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [responses]);

  const agentCards = useMemo(() => {
    const colors = ["#8b3ff4", "#168ba5", "#aa4b0f", "#24476f", "#5f1f72"];
    return allAgents.map((agent, index) => {
      const stats = {
        calls: agent.today_calls || 0,
        connected: agent.today_connected || 0,
        positive: agent.today_positive || 0,
      };
      const initials = agent.name?.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "AG";

      return {
        dbId: agent.id,
        id: agent.employee_id,
        name: agent.name,
        zohoId: agent.zoho_id || "NA",
        role: agent.role || "agent",
        calls: stats.calls,
        connected: stats.connected,
        positive: stats.positive,
        initials,
        connectRate: stats.calls ? Math.round((stats.connected / stats.calls) * 100) : 0,
        conversionRate: stats.connected ? Math.round((stats.positive / stats.connected) * 100) : 0,
        status: normalizeAgentStatus(agent.status),
        loginTime: agent.login_time || null,
        totalLoginDuration: agent.total_login_duration || 0,
        activeSessionDuration: agent.active_session_duration || 0,
        staffTimeDuration: Math.max((agent.total_login_duration || 0) - (agent.total_break_duration || 0), 0),
        breakCount: agent.break_count || 0,
        totalBreakDuration: agent.total_break_duration || 0,
        currentBreakDuration: agent.current_break_duration || 0,
        activeSessionCount: agent.active_session_count || 0,
        breakReason: agent.break_reason || "",
        breakRemark: agent.break_remark || "",
        breakStartTime: agent.break_start_time || null,
        breakEndTime: agent.break_end_time || null,
        color: colors[index % colors.length],
        badge: normalizeAgentStatus(agent.status) === "online" ? "online" : normalizeAgentStatus(agent.status) === "break" ? "break" : "offline",
      };
    }).sort((a, b) => b.calls - a.calls);
  }, [allAgents]);

  const filteredAgentCards = useMemo(() => {
    const term = agentSearch.trim().toLowerCase();

    return agentCards.filter((agent) => {
      const matchesSearch =
        !term ||
        agent.name.toLowerCase().includes(term) ||
        agent.id.toLowerCase().includes(term) ||
        agent.zohoId.toLowerCase().includes(term);
      const matchesStatus = agentStatusFilter === "all" || agent.status === agentStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [agentCards, agentSearch, agentStatusFilter]);

  const reportRows = useMemo(() => {
    return reportRecords;
  }, [reportRecords]);

  const groupedReportRows = useMemo(() => {
    const groups = [
      ["Today", []],
      ["Yesterday", []],
      ["Older", []],
    ];
    const groupMap = new Map(groups);

    responses
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .forEach((item) => {
        const key =
          item.report_group === "today"
            ? "Today"
            : item.report_group === "yesterday"
              ? "Yesterday"
              : "Older";
        groupMap.get(key).push(item);
      });

    return groups.map(([label]) => [label, groupMap.get(label)]);
  }, [responses]);

  const reportSummary = useMemo(() => {
    const total = reportRows.length;
    const connected = reportRows.filter((item) => item.call_status === "Connected").length;
    const positive = reportRows.filter(
      (item) => item.disposition === "Positive" || item.disposition === "Already Positive"
    ).length;
    const callback = reportRows.filter((item) => item.disposition === "Call Back").length;

    return {
      total,
      connected,
      positive,
      callback,
      connectRate: total ? Math.round((connected / total) * 100) : 0,
      conversionRate: connected ? Math.round((positive / connected) * 100) : 0,
    };
  }, [reportRows]);

  const reportAgentStats = useMemo(() => {
    const stats = new Map();

    reportRows.forEach((item) => {
      const key = item.employee_id || "NA";
      const current = stats.get(key) || {
        id: key,
        name: item.employee_name || key,
        total: 0,
        connected: 0,
        positive: 0,
      };

      stats.set(key, {
        ...current,
        total: current.total + 1,
        connected: current.connected + (item.call_status === "Connected" ? 1 : 0),
        positive:
          current.positive +
          (item.disposition === "Positive" || item.disposition === "Already Positive" ? 1 : 0),
      });
    });

    return Array.from(stats.values())
      .map((agent) => ({
        ...agent,
        connectRate: agent.total ? Math.round((agent.connected / agent.total) * 100) : 0,
        conversionRate: agent.connected ? Math.round((agent.positive / agent.connected) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [reportRows]);

  const reportDispositionStats = useMemo(() => countBy(reportRows, "disposition"), [reportRows]);
  const reportSubDispositionStats = useMemo(() => countBy(reportRows, "sub_disposition"), [reportRows]);
  const reportTopDisposition = reportDispositionStats[0] || { label: "NA", value: 0 };
  const reportTopAgent = reportAgentStats[0] || { name: "NA", total: 0, conversionRate: 0 };
  const maxReportAgentTotal = Math.max(...reportAgentStats.map((item) => item.total), 1);
  const maxReportDisposition = Math.max(...reportDispositionStats.map((item) => item.value), 1);
  const maxReportSubDisposition = Math.max(...reportSubDispositionStats.map((item) => item.value), 1);

  const reportKpis = useMemo(() => {
    if (reportType === "agent") {
      return [
        ["AGENTS", reportAgentStats.length, "#c681ff"],
        ["AVG CONNECT", `${reportAgentStats.length ? Math.round(reportAgentStats.reduce((sum, agent) => sum + agent.connectRate, 0) / reportAgentStats.length) : 0}%`, "#27d8ff"],
        ["AVG CONVERSION", `${reportAgentStats.length ? Math.round(reportAgentStats.reduce((sum, agent) => sum + agent.conversionRate, 0) / reportAgentStats.length) : 0}%`, "#35e5a7"],
        ["TOP AGENT", reportTopAgent.name, "#ffd02d"],
        ["TOP CALLS", reportTopAgent.total, "#ff717e"],
      ];
    }

    if (reportType === "disposition") {
      return [
        ["TOTAL CALLS", reportSummary.total, "#c681ff"],
        ["DISPOSITIONS", reportDispositionStats.length, "#27d8ff"],
        ["TOP DISPOSITION", reportTopDisposition.label, "#ffd02d"],
        ["TOP COUNT", reportTopDisposition.value, "#35e5a7"],
        ["CALL BACK", reportSummary.callback, "#ff717e"],
      ];
    }

    if (reportType === "conversion") {
      return [
        ["TOTAL CALLS", reportSummary.total, "#c681ff"],
        ["POSITIVE", reportSummary.positive, "#35e5a7"],
        ["CONVERSION", `${reportSummary.conversionRate}%`, "#27d8ff"],
        ["TOP AGENT", reportTopAgent.name, "#ffd02d"],
        ["CONNECT RATE", `${reportSummary.connectRate}%`, "#ff717e"],
      ];
    }

    return [
      ["TOTAL CALLS", reportSummary.total, "#c681ff"],
      ["CONNECTED", reportSummary.connected, "#27d8ff"],
      ["CONNECT RATE", `${reportSummary.connectRate}%`, "#35e5a7"],
      ["POSITIVE", reportSummary.positive, "#ffd02d"],
      ["CALL BACK", reportSummary.callback, "#ff717e"],
    ];
  }, [
    reportAgentStats,
    reportDispositionStats.length,
    reportSummary,
    reportTopAgent,
    reportTopDisposition,
    reportType,
  ]);

  const dispositionBreakdown = useMemo(() => countBy(responses, "disposition"), [responses]);
  const subDispositionBreakdown = useMemo(() => countBy(responses, "sub_disposition"), [responses]);
  const languageBreakdown = useMemo(() => countBy(responses, "language"), [responses]);
  const topDisposition = dispositionBreakdown[0] || { label: "NA", value: 0 };
  const topLanguage = languageBreakdown[0] || { label: "NA", value: 0 };
  const totalResponsePages = responsePagination.totalPages || 1;
  const currentResponsePage = Math.min(responsePagination.page || responsePage, totalResponsePages);
  const paginatedResponses = filteredResponses;
  const avgCallsPerAgent = analytics.activeAgents
    ? Math.round(analytics.totalCalls / analytics.activeAgents)
    : 0;
  const maxSubDisposition = Math.max(...subDispositionBreakdown.map((item) => item.value), 1);
  const maxAgentCalls = Math.max(...agentPerformance.map((item) => item.total), 1);
  const maxStatusCalls = Math.max(
    analytics.connectedCalls,
    analytics.notConnectedCalls,
    analytics.positiveCalls,
    analytics.totalCalls,
    1
  );
  const callStatusBars = [
    {
      label: "Connected",
      value: analytics.connectedCalls,
      note: `${analytics.connectRate}% rate`,
      color: "linear-gradient(180deg, #31e7ff 0%, #2297ff 100%)",
      glow: "rgba(39, 216, 255, 0.24)",
    },
    {
      label: "Not Connected",
      value: analytics.notConnectedCalls,
      note: "Today only",
      color: "linear-gradient(180deg, #ff8da0 0%, #ff4f77 100%)",
      glow: "rgba(255, 113, 126, 0.24)",
    },
    {
      label: "Positive",
      value: analytics.positiveCalls,
      note: `${analytics.conversionRate}% conversion`,
      color: "linear-gradient(180deg, #54f0b9 0%, #20bf7f 100%)",
      glow: "rgba(53, 229, 167, 0.24)",
    },
    {
      label: "Total Calls",
      value: analytics.totalCalls,
      note: "All calls",
      color: "linear-gradient(180deg, #d6a6ff 0%, #8b5cf6 100%)",
      glow: "rgba(198, 129, 255, 0.24)",
    },
  ];
  const dispositionColors = ["#25d8ef", "#35e5a7", "#ff717e", "#c681ff", "#ffd02d", "#8b5cf6"];
  const visibleDispositionSegments = dispositionBreakdown.slice(0, 6);
  const dispositionTotal = Math.max(
    visibleDispositionSegments.reduce((sum, item) => sum + item.value, 0),
    1
  );
  let dispositionCursor = 0;
  const dispositionSegments = visibleDispositionSegments.map((item, index) => {
    const start = dispositionCursor;
    const size = (item.value / dispositionTotal) * 100;
    dispositionCursor += size;
    return {
      ...item,
      color: dispositionColors[index % dispositionColors.length],
      percent: Math.round((item.value / dispositionTotal) * 100),
      start,
      end: dispositionCursor,
    };
  });
  const dispositionGradient = dispositionSegments.length
    ? `conic-gradient(${dispositionSegments
        .map((item) => `${item.color} ${item.start}% ${item.end}%`)
        .join(", ")})`
    : "conic-gradient(rgba(132, 80, 255, 0.22) 0 100%)";

  const loadResponses = async () => {
       if (responses.length === 0) {
      setIsLoadingResponses(true);
    }
    try {
      const data = await getAllResponses(token, {
        page: responsePage,
        pageSize: responsePageSize,
        date: dateFilter,
        employeeId: agentFilter,
        employeeName: employeeNameFilter,
        referenceId: referenceIdFilter,
        callStatus: statusFilter,
        disposition: dispositionFilter,
        search,
      });
      setResponses(data.records || []);
      setAdminSummary(data.summary || fallbackAdminSummary);
      setResponsePagination(data.pagination || { page: responsePage, pageSize: responsePageSize, total: 0, totalPages: 1 });
      if (data.pagination?.totalPages && responsePage > data.pagination.totalPages) {
        setResponsePage(data.pagination.totalPages);
      }
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to load admin data.");
    } finally {
      setIsLoadingResponses(false); // Set loading false after fetch
    }
  };

  const buildReportParams = () => ({
    page: 1,
    pageSize: 50,
    dateFrom: reportDateFrom,
    dateTo: reportDateTo,
    employeeId: reportAgent,
  });

  const buildReportExportParams = () => ({
    exportAll: "true",
    dateFrom: reportDateFrom,
    dateTo: reportDateTo,
    employeeId: reportAgent,
  });

  const buildTimeReportParams = () => ({
    dateFrom: timeReportDateFrom,
    dateTo: timeReportDateTo,
    employeeId: timeReportAgent,
  });

  const buildDowntimeReportParams = () => ({
    dateFrom: downtimeReportDateFrom,
    dateTo: downtimeReportDateTo,
    employeeId: downtimeReportAgent,
  });

  const buildDowntimeHistoryParams = () => ({
    dateFrom: downtimeHistoryDateFrom,
    dateTo: downtimeHistoryDateTo,
    employeeId: downtimeHistoryAgent,
    status: downtimeHistoryStatus,
    issueType: downtimeHistoryIssueType,
  });

  const buildRankingReportParams = () => ({
    startDate: rankingReportDateFrom,
    endDate: rankingReportDateTo,
    agentId: rankingReportAgent,
  });

  const loadReportRows = async () => {
    setIsReportLoading(true);
    try {
      const data = await getAllResponses(token, buildReportParams());
      setReportRecords(data.records || []);
      setReportGenerated(true);
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to generate report.");
    } finally {
      setIsReportLoading(false);
    }
  };

  const loadTimeReportRows = async () => {
    setIsTimeReportLoading(true);
    try {
      const data = await getTimeReport(token, buildTimeReportParams());
      setTimeReportRecords(data.records || []);
      setTimeReportSummary(data.summary || {
        totalLoginDuration: 0,
        totalBreakDuration: 0,
        staffTimeDuration: 0,
        totalBreakCount: 0,
      });
      setTimeReportGenerated(true);
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to generate session and break report.");
    } finally {
      setIsTimeReportLoading(false);
    }
  };

  const loadRankingReportRows = async () => {
    setIsRankingReportLoading(true);
    try {
      const data = await getAdminLeaderboard(token, buildRankingReportParams());
      setRankingReportRows(data.leaderboard || []);
      setRankingReportGenerated(true);
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to generate ranking report.");
    } finally {
      setIsRankingReportLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const data = await getAgentMonitoring(token);
      setAllAgents(data);
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  };

  const loadManagedAdmins = async () => {
    if (!isSuperAdmin || !token) return;

    try {
      const data = await getManagedAdmins(token);
      setManagedAdmins(data.admins || []);
      setManagedAdminSummary(data.summary || {
        totalAdmins: 0,
        activeAdmins: 0,
        totalAgents: 0,
        onlineAgents: 0,
      });
    } catch (error) {
      setFeedback(error.message || "Unable to load admins.");
    }
  };

  const loadAuditLogs = async () => {
    if (!isSuperAdmin || !token) return;

    try {
      const data = await getAuditLogs(token, auditFilters);
      setAuditLogs(data.logs || []);
    } catch (error) {
      setFeedback(error.message || "Unable to load Admin History.");
    }
  };

  useEffect(() => {
    if (activeView === "manage-admins") {
      loadManagedAdmins();
    }

    if (activeView === "audit-logs") {
      loadAuditLogs();
    }

    if (activeView === "downtime") {
      loadDowntimeRequests();
    }

    if (activeView === "downtime-history") {
      loadDowntimeHistoryRows();
    }
  }, [activeView, auditFilters, isSuperAdmin, token]);

  useEffect(() => {
    if (activeView === "downtime-history" && token) {
      loadDowntimeHistoryRows();
    }
  }, [
    activeView,
    token,
    downtimeHistoryDateFrom,
    downtimeHistoryDateTo,
    downtimeHistoryAgent,
    downtimeHistoryStatus,
    downtimeHistoryIssueType,
  ]);

  useEffect(() => {
    if (token) {
      loadResponses();
      loadAgents();
      loadDowntimeRequests();

      const interval = setInterval(() => {
        loadResponses();
        loadAgents();
        loadDowntimeRequests();
      }, 5000); 

      return () => clearInterval(interval);
    }
  }, [
    token,
    responsePage,
    responsePageSize,
    dateFilter,
    agentFilter,
    employeeNameFilter,
    referenceIdFilter,
    statusFilter,
    dispositionFilter,
    search,
  ]);

  useEffect(() => {
    if (!token || !isDowntimeApprover) {
      return undefined;
    }

    const socket = createDowntimeSocket(token);

    const mergeDowntimeRequest = (request) => {
      if (!request?.id) {
        return;
      }

      setDowntimeRequests((currentRequests) => {
        const exists = currentRequests.some((item) => item.id === request.id);

        if (!exists) {
          return [request, ...currentRequests];
        }

        return currentRequests.map((item) => (item.id === request.id ? { ...item, ...request } : item));
      });
    };

    const handleDowntimeEvent = (eventName) => (request) => {
      mergeDowntimeRequest(request);

      if (eventName === "new_downtime_request") {
        setDowntimeNotifications((currentNotifications) => [
          {
            id: `${request.id}-${Date.now()}`,
            request,
          },
          ...currentNotifications,
        ].slice(0, 5));
        setUnreadDowntimeCount((count) => count + 1);
      }
    };

    const handlers = downtimeSocketEvents.map((eventName) => {
      const handler = handleDowntimeEvent(eventName);
      socket.on(eventName, handler);
      return [eventName, handler];
    });

    return () => {
      handlers.forEach(([eventName, handler]) => socket.off(eventName, handler));
      socket.disconnect();
    };
  }, [token, isDowntimeApprover]);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const openDowntimeNotifications = () => {
    setUnreadDowntimeCount(0);
    setActiveView("downtime");
    navigate(isSuperAdmin ? "/super-admin" : "/admin");
  };

  const openLogoutConfirmation = () => {
    setIsLogoutConfirmationOpen(true);
  };

  const closeLogoutConfirmation = () => {
    setIsLogoutConfirmationOpen(false);
  };

  const handleCreateAgent = async (event) => {
    event.preventDefault();

    if (!agentForm.employeeId || !agentForm.name || !agentForm.password) {
      setFeedback("Agent ke Employee ID, Name, aur Password required hain.");
      return;
    }

    try {
      await registerUser({
        ...agentForm,
        role: "agent",
      });
      setAgentForm({ employeeId: "", name: "", password: "" });
      setFeedback("Agent created successfully.");
    } catch (error) {
      setFeedback(error.message || "Agent create nahi ho paya.");
    }
  };

  const openEditAgent = (agent) => {
    setEditingAgent(agent);
    setEditAgentForm({
      name: agent.name || "",
      employeeId: agent.id || "",
      password: "",
      role: agent.role || "agent",
    });
  };

  const closeAgentModal = () => {
    if (isAgentActionLoading) {
      return;
    }

    setEditingAgent(null);
    setDeletingAgent(null);
    setForceLogoutTarget(null);
    setEditAgentForm({ name: "", employeeId: "", password: "", role: "agent" });
  };

  const handleUpdateAgent = async (event) => {
    event.preventDefault();

    if (!editingAgent) {
      return;
    }

    if (!editAgentForm.name.trim() || !editAgentForm.employeeId.trim()) {
      setFeedback("Agent name and Employee ID required hain.");
      return;
    }

    setIsAgentActionLoading(true);

    try {
      await updateAgent(
        editingAgent.dbId,
        {
          name: editAgentForm.name,
          employeeId: editAgentForm.employeeId,
          password: editAgentForm.password,
          role: editAgentForm.role,
        },
        token
      );
      setEditingAgent(null);
      setEditAgentForm({ name: "", employeeId: "", password: "", role: "agent" });
      await Promise.all([loadAgents(), loadResponses()]);
      setFeedback("Agent updated successfully.");
    } catch (error) {
      setFeedback(error.message || "Agent update nahi ho paya.");
    } finally {
      setIsAgentActionLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deletingAgent) {
      return;
    }

    setIsAgentActionLoading(true);

    try {
      await deleteAgent(deletingAgent.dbId, token);
      setDeletingAgent(null);
      await Promise.all([loadAgents(), loadResponses()]);
      setFeedback("Agent deleted successfully.");
    } catch (error) {
      setFeedback(error.message || "Agent delete nahi ho paya.");
    } finally {
      setIsAgentActionLoading(false);
    }
  };

  const handleForceLogout = async () => {
    if (!forceLogoutTarget) {
      return;
    }

    setIsAgentActionLoading(true);

    try {
      if (forceLogoutTarget.type === "all") {
        await forceLogoutAllAgents(token);
        setFeedback("All active agents logged out successfully.");
      } else {
        await forceLogoutAgent(forceLogoutTarget.agent.dbId, token);
        setFeedback(`${forceLogoutTarget.agent.name} logged out successfully.`);
      }

      setForceLogoutTarget(null);
      await Promise.all([loadAgents(), loadResponses()]);
    } catch (error) {
      setFeedback(error.message || "Force logout failed.");
    } finally {
      setIsAgentActionLoading(false);
    }
  };

  const handleDowntimeAction = async (request, action) => {
    setDowntimeActionId(request.id);

    try {
      if (action === "approve") {
        await approveDowntimeRequest(request.id, token);
        setFeedback("Downtime request approved. Duration starts now.");
      } else if (action === "reject") {
        await rejectDowntimeRequest(request.id, token);
        setFeedback("Downtime request rejected.");
      } else if (action === "resolve") {
        await resolveDowntimeRequest(request.id, token);
        setFeedback("Downtime resolved.");
      }

      await loadDowntimeRequests();
    } catch (error) {
      setFeedback(error.message || "Downtime action failed.");
    } finally {
      setDowntimeActionId(null);
    }
  };

  const openCreateAdmin = () => {
    setSelectedAdmin(null);
    setAdminForm({ name: "", employeeId: "", email: "", password: "", role: "admin", status: "active" });
    setAdminModalMode("create");
  };

  const loadDowntimeRequests = async () => {
    setIsDowntimeLoading(true);
    try {
      const data = await getDowntimeRequests(token);
      setDowntimeRequests(data.requests || []);
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to load downtime requests.");
    } finally {
      setIsDowntimeLoading(false);
    }
  };

  const loadDowntimeReportRows = async () => {
    setIsDowntimeReportLoading(true);
    try {
      const data = await getDowntimeReport(token, buildDowntimeReportParams());
      setDowntimeReportRecords(data.records || []);
      setDowntimeReportGenerated(true);
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to generate downtime report.");
    } finally {
      setIsDowntimeReportLoading(false);
    }
  };

  const loadDowntimeHistoryRows = async () => {
    setIsDowntimeHistoryLoading(true);
    try {
      const data = await getDowntimeHistory(token, buildDowntimeHistoryParams());
      setDowntimeHistoryRecords(data.records || []);
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to load downtime history.");
    } finally {
      setIsDowntimeHistoryLoading(false);
    }
  };

  const openEditAdmin = (admin) => {
    setSelectedAdmin(admin);
    setAdminForm({
      name: admin.name || "",
      employeeId: admin.employeeId || "",
      email: admin.email || "",
      password: "",
      role: admin.role || "admin",
      status: admin.status || "active",
    });
    setAdminModalMode("edit");
  };

  const closeAdminModal = () => {
    if (isAdminActionLoading) return;
    setAdminModalMode("");
    setSelectedAdmin(null);
    setAdminForm({ name: "", employeeId: "", email: "", password: "", role: "admin", status: "active" });
  };

  const saveManagedAdmin = async (event) => {
    event.preventDefault();

    if (!adminForm.name.trim() || !adminForm.email.trim() || (adminModalMode === "create" && (!adminForm.employeeId.trim() || !adminForm.password))) {
      setFeedback("Full Name, Employee ID, Email, and Password are required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminForm.email.trim())) {
      setFeedback("Valid email is required.");
      return;
    }

    setIsAdminActionLoading(true);

    try {
      const cleanName = adminForm.name.trim();
      const cleanEmail = adminForm.email.trim();
      const cleanPassword = adminForm.password.trim();

      if (adminModalMode === "create") {
        await createManagedAdmin(
          {
            name: cleanName,
            employee_id: adminForm.employeeId.trim(),
            email: cleanEmail,
            password: cleanPassword,
            role: adminForm.role || "admin",
          },
          token
        );
        setFeedback("Admin created successfully.");
      } else if (selectedAdmin) {
        const payload = {
          name: cleanName,
          email: cleanEmail,
          status: adminForm.status,
        };

        if (cleanPassword) {
          payload.password = cleanPassword;
        }

        await updateManagedAdmin(
          selectedAdmin.id,
          payload,
          token
        );
        setFeedback("Admin updated successfully.");
      }

      setAdminModalMode("");
      setSelectedAdmin(null);
      setAdminForm({ name: "", employeeId: "", email: "", password: "", role: "admin", status: "active" });
      await loadManagedAdmins();
    } catch (error) {
      setFeedback(error.message || "Admin action failed.");
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const deleteManagedAdminAccount = async (admin) => {
    const confirmed = window.confirm(`Delete admin ${admin.name}?`);
    if (!confirmed) return;

    try {
      await deleteManagedAdmin(admin.id, token);
      setFeedback("Admin deleted successfully.");
      await loadManagedAdmins();
    } catch (error) {
      setFeedback(error.message || "Unable to delete admin.");
    }
  };

  const forceLogoutManagedAdminAccount = async (admin) => {
    try {
      await forceLogoutManagedAdmin(admin.id, token);
      setFeedback("Admin force logged out successfully.");
      await loadManagedAdmins();
    } catch (error) {
      setFeedback(error.message || "Unable to force logout admin.");
    }
  };

  const clearResponseFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDispositionFilter("all");
    setAgentFilter("all");
    setLanguageFilter("all");
    setDateFilter("");
    setEmployeeNameFilter("");
    setReferenceIdFilter("");
    setResponsePage(1);
  };

  const buildReportTableRows = (rows = reportRows) =>
    rows
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.employee_name)}</td>
            <td>${escapeHtml(item.employee_id)}</td>
            <td>${escapeHtml(item.zoho_id)}</td>
            <td>${escapeHtml(item.dialer_id)}</td>
            <td>${escapeHtml(item.reference_id)}</td>
            <td>${escapeHtml(item.call_status)}</td>
            <td>${escapeHtml(item.call_status === "Connected" ? "Connected" : "Not Connected")}</td>
            <td>${escapeHtml(item.disposition)}</td>
            <td>${escapeHtml(item.sub_disposition)}</td>
            <td>${escapeHtml(item.language === "Other" ? item.language_other || "Other" : item.language)}</td>
            <td>${escapeHtml(formatDateOnly(item.created_at))}</td>
            <td>${escapeHtml(formatTimeOnly(item.created_at))}</td>
          </tr>
        `
      )
      .join("");

  const downloadReport = async (format = "csv") => {
    let rowsForExport = [];

    try {
      const data = await getAllResponses(token, buildReportExportParams());
      rowsForExport = data.records || [];
    } catch (error) {
      setFeedback(error.message || "Unable to load report export rows.");
      return;
    }

    if (!rowsForExport.length) {
      setFeedback("No report rows match these filters.");
      return;
    }

    const headers = [
      "employee_name",
      "employee_id",
      "zoho_id",
      "dialer",
      "reference_id",
      "call_status",
      "connected_status",
      "date",
      "time",
      "disposition",
      "sub_disposition",
      "language",
    ];
    const escapeCsv = (value) => {
      if (value === null || value === undefined) {
        return "";
      }

      const text = String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = rowsForExport.map((item) =>
      [
        item.employee_name,
        item.employee_id,
        item.zoho_id,
        item.dialer_id,
        item.reference_id,
        item.call_status,
        item.call_status === "Connected" ? "Connected" : "Not Connected",
        formatDateOnly(item.created_at),
        formatTimeOnly(item.created_at),
        item.disposition,
        item.sub_disposition,
        item.language === "Other" ? item.language_other || "Other" : item.language,
      ]
        .map(escapeCsv)
        .join(",")
    );
    const content =
      format === "excel"
        ? `
          <html>
            <head><meta charset="utf-8" /></head>
            <body>
              <h2>${reportType} report</h2>
              <p>${reportDateFrom} to ${reportDateTo}</p>
              <table border="1">
                <thead>
                  <tr>
                    <th>Agent</th><th>Employee ID</th><th>Zoho ID</th><th>Dialer</th>
                    <th>Customer Name</th><th>Call Status</th><th>Connected Status</th><th>Disposition</th>
                    <th>Sub-disposition</th><th>Language</th><th>Date</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>${buildReportTableRows(rowsForExport)}</tbody>
              </table>
            </body>
          </html>
        `
        : [headers.join(","), ...rows].join("\n");
    const blob = new Blob([content], {
      type: format === "excel" ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType}-report-${reportDateFrom}-to-${reportDateTo}.${format === "excel" ? "xls" : "csv"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    if (isSuperAdmin) {
      createAuditLog(
        {
          action: "report_download",
          target: `${reportType} ${format === "excel" ? "Excel" : "CSV"} Report`,
          targetType: "report",
          metadata: { reportType, format, rows: rowsForExport.length },
        },
        token
      ).catch(() => {});
    }
  };

  const printReport = async () => {
    let rowsForExport = [];

    try {
      const data = await getAllResponses(token, buildReportExportParams());
      rowsForExport = data.records || [];
    } catch (error) {
      setFeedback(error.message || "Unable to load report print rows.");
      return;
    }

    if (!rowsForExport.length) {
      setFeedback("No report rows match these filters.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=800");

    if (!printWindow) {
      return;
    }

    const total = rowsForExport.length;
    const connected = rowsForExport.filter((item) => item.call_status === "Connected").length;
    const positive = rowsForExport.filter(
      (item) => item.disposition === "Positive" || item.disposition === "Already Positive"
    ).length;
    const callback = rowsForExport.filter((item) => item.disposition === "Call Back").length;
    const connectRate = total ? Math.round((connected / total) * 100) : 0;
    const printKpis = [
      ["TOTAL CALLS", total],
      ["CONNECTED", connected],
      ["CONNECT RATE", `${connectRate}%`],
      ["POSITIVE", positive],
      ["CALL BACK", callback],
    ];

    printWindow.document.write(`
      <html>
        <head>
          <title>Dialflow.ai ${reportType} report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { margin-bottom: 4px; }
            .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 20px 0; }
            .kpi { border: 1px solid #d1d5db; padding: 12px; border-radius: 8px; }
            .label { color: #6b7280; font-size: 12px; }
            .value { font-size: 24px; margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Dialflow.ai ${reportType} report</h1>
          <div style="color:#6b7280;margin-bottom:6px;">Powered by Dhritii.ai</div>
          <div>${reportDateFrom} to ${reportDateTo} | ${rowsForExport.length} records</div>
          <div class="kpis">
            ${printKpis
              .map(([label, value]) => `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div></div>`)
              .join("")}
          </div>
          <table>
            <thead>
              <tr>
                <th>Agent</th><th>Employee ID</th><th>Zoho ID</th><th>Dialer</th>
                <th>Customer Name</th><th>Call Status</th><th>Connected Status</th><th>Disposition</th>
                <th>Sub-disposition</th><th>Language</th><th>Date</th><th>Time</th>
              </tr>
            </thead>
            <tbody>${buildReportTableRows(rowsForExport)}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadTimeReport = async () => {
    if (!timeReportRecords.length) {
      setFeedback("No session or break rows match these filters.");
      return;
    }

    try {
      await downloadTimeReportExport(token, buildTimeReportParams());
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to download session and break report.");
    }
  };

  const rankingReportDateLabel = () => {
    if (rankingReportDateFrom && rankingReportDateTo) {
      return rankingReportDateFrom === rankingReportDateTo
        ? rankingReportDateFrom
        : `${rankingReportDateFrom} to ${rankingReportDateTo}`;
    }

    return rankingReportDateFrom || rankingReportDateTo || "All Dates";
  };

  const downloadRankingReport = () => {
    if (!rankingReportRows.length) {
      setFeedback("No ranking rows match these filters.");
      return;
    }

    const headers = [
      "Rank",
      "Agent Name",
      "Employee ID",
      "Date",
      "Score",
      "Positive",
      "Connected",
      "Total Calls",
      "Conversion %",
    ];
    const escapeCsv = (value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const dateLabel = rankingReportDateLabel();
    const rows = rankingReportRows.map((row) =>
      [
        row.rank,
        row.agent_name,
        row.employee_id,
        dateLabel,
        row.ranking_score,
        row.positive_calls,
        row.connected_calls,
        row.total_calls,
        row.conversion_rate,
      ]
        .map(escapeCsv)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ranking-conversion-report-${rankingReportDateFrom || "start"}-to-${rankingReportDateTo || "end"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    if (isSuperAdmin) {
      createAuditLog(
        {
          action: "ranking_export",
          target: "Ranking Conversion CSV",
          targetType: "ranking",
          metadata: { rows: rankingReportRows.length },
        },
        token
      ).catch(() => {});
    }
  };

  const auditAdminOptions = useMemo(
    () => Array.from(new Set(auditLogs.map((log) => log.adminName).filter(Boolean))).sort(),
    [auditLogs]
  );

  const auditActionOptions = [
    "agent_edit",
    "agent_delete",
    "agent_logout",
    "admin_edit",
    "admin_delete",
    "report_download",
    "ranking_export",
  ];

  const formatAuditAction = (action) =>
    String(action || "")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const exportAuditLogsCsv = () => {
    if (!auditLogs.length) {
      setFeedback("No Admin History match these filters.");
      return;
    }

    const headers = ["Admin Name", "Action", "Target", "Date", "Time"];
    const escapeCsv = (value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = auditLogs.map((log) =>
      [
        log.adminName,
        log.actionLabel || formatAuditAction(log.action),
        log.target,
        formatReportDateOnly(log.createdAt),
        formatTimeOnly(log.createdAt),
      ]
        .map(escapeCsv)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadDowntimeReport = () => {
    if (!downtimeReportRecords.length) {
      setFeedback("No downtime rows match these filters.");
      return;
    }

    const headers = [
      "Agent Name",
      "Employee ID",
      "Date",
      "Issue Type",
      "Comment",
      "Approved By",
      "Start Time",
      "End Time",
      "Duration",
    ];
    const escapeCsv = (value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = downtimeReportRecords.map((row) =>
      [
        row.agentName,
        row.employeeId,
        formatReportDateOnly(row.requestedAt),
        row.issueType,
        row.comment,
        row.approvedByName || "NA",
        formatDateTime(row.approvedAt),
        formatDateTime(row.resolvedAt),
        formatDurationHuman(row.durationSeconds || row.runningDurationSeconds),
      ]
        .map(escapeCsv)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `downtime-report-${downtimeReportDateFrom}-to-${downtimeReportDateTo}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportAuditLogsPdf = () => {
    if (!auditLogs.length) {
      setFeedback("No Admin History match these filters.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Dialflow.ai Admin History</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Dialflow.ai Admin History</h1>
          <div style="color:#6b7280;margin-bottom:6px;">Powered by Dhritii.ai</div>
          <div>${auditLogs.length} records</div>
          <table>
            <thead>
              <tr><th>Admin Name</th><th>Action</th><th>Target</th><th>Date</th><th>Time</th></tr>
            </thead>
            <tbody>
              ${auditLogs
                .map(
                  (log) => `
                    <tr>
                      <td>${escapeHtml(log.adminName)}</td>
                      <td>${escapeHtml(log.actionLabel || formatAuditAction(log.action))}</td>
                      <td>${escapeHtml(log.target)}</td>
                      <td>${escapeHtml(formatReportDateOnly(log.createdAt))}</td>
                      <td>${escapeHtml(formatTimeOnly(log.createdAt))}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleNavClick = (id) => {
    setActiveView(id);

    if (isSuperAdmin) {
      if (id === "manage-admins") {
        navigate("/super-admin/manage-admins");
      } else if (id === "audit-logs") {
        navigate("/super-admin/audit-logs");
      } else if (id === "downtime-history") {
        navigate("/super-admin/downtime-history");
      } else {
        navigate("/super-admin");
      }
    } else if (id === "downtime-history") {
      navigate("/admin/downtime-history");
    } else if (id === "overview") {
      navigate("/admin");
    }
  };

  const buildTimeReportTableRows = () =>
    timeReportRecords
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.agent_name)}</td>
            <td>${escapeHtml(item.employee_id)}</td>
            <td>${escapeHtml(formatReportDateOnly(item.login_time))}</td>
            <td>${escapeHtml(formatTimeOnly(item.login_time))}</td>
            <td>${escapeHtml(formatTimeOnly(item.logout_time))}</td>
            <td>${escapeHtml(item.break_number || "")}</td>
            <td>${escapeHtml(item.break_reason || "")}</td>
            <td>${escapeHtml(formatTimeOnly(item.break_start_time))}</td>
            <td>${escapeHtml(formatTimeOnly(item.break_end_time))}</td>
            <td>${escapeHtml(formatDurationHuman(item.break_duration))}</td>
            <td>${escapeHtml(formatDurationHuman(item.total_login_duration))}</td>
            <td>${escapeHtml(formatDurationHuman(item.staff_time_duration))}</td>
            <td>${escapeHtml(formatDurationHuman(item.total_break_duration))}</td>
          </tr>
        `
      )
      .join("");

  const printTimeReport = () => {
    if (!timeReportRecords.length) {
      setFeedback("No session or break rows match these filters.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=800");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Dialflow.ai Session and Break Time Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { margin-bottom: 4px; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
            .kpi { border: 1px solid #d1d5db; padding: 12px; border-radius: 8px; }
            .label { color: #6b7280; font-size: 12px; }
            .value { font-size: 20px; margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Dialflow.ai Session and Break Time Report</h1>
          <div style="color:#6b7280;margin-bottom:6px;">Powered by Dhritii.ai</div>
          <div>${timeReportDateFrom} to ${timeReportDateTo} | ${timeReportRecords.length} break rows</div>
          <div class="kpis">
            <div class="kpi"><div class="label">Total Login Time</div><div class="value">${formatDurationHuman(timeReportSummary.totalLoginDuration)}</div></div>
            <div class="kpi"><div class="label">Total Staff Time</div><div class="value">${formatDurationHuman(timeReportSummary.staffTimeDuration)}</div></div>
            <div class="kpi"><div class="label">Break Time</div><div class="value">${formatDurationHuman(timeReportSummary.totalBreakDuration)}</div></div>
            <div class="kpi"><div class="label">Break Count</div><div class="value">${timeReportSummary.totalBreakCount}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Agent Name</th><th>Employee ID</th><th>Login Date</th><th>Login Time</th><th>Logout Time</th>
                <th>Break #</th><th>Break Reason</th><th>Break Start</th><th>Break End</th><th>Break Duration</th>
                <th>Total Login</th><th>Total Staff</th><th>Total Break Time</th>
              </tr>
            </thead>
            <tbody>${buildTimeReportTableRows()}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="crm-theme-root" data-theme={theme} style={shell}>
      <style>
        {`
          .admin-select option {
            background: #18162a;
            color: #f4f0ff;
          }

          .admin-scroll::-webkit-scrollbar {
            height: 10px;
            width: 10px;
          }

          .admin-scroll::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.06);
          }

          .admin-scroll::-webkit-scrollbar-thumb {
            background: rgba(180, 169, 205, 0.65);
            border-radius: 999px;
          }

          .admin-soft-panel {
            box-shadow: 0 18px 56px rgba(0, 0, 0, 0.24);
          }

          .admin-hover-card,
          .admin-action-button {
            transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
          }

          .admin-hover-card:hover,
          .admin-action-button:hover {
            transform: translateY(-1px);
            border-color: rgba(168, 85, 247, 0.72) !important;
            box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28);
          }

          .admin-polished-table th {
            position: sticky;
            top: 0;
            z-index: 1;
            background: #121027;
          }

          .admin-polished-table tbody tr {
            transition: background 140ms ease;
          }

          .admin-polished-table tbody tr:hover {
            background: rgba(122, 73, 255, 0.08);
          }

          .admin-empty-state {
            min-height: 120px;
            display: grid;
            place-items: center;
            text-align: center;
            color: #7d849f;
            border: 1px dashed rgba(122, 73, 255, 0.32);
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.025);
          }

          .admin-section-heading {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: center;
            flex-wrap: wrap;
          }

          .overview-status-bars {
            margin-top: 26px;
            min-height: 270px;
            display: grid;
            grid-template-columns: repeat(4, minmax(112px, 1fr));
            gap: 24px;
            align-items: end;
          }

          .overview-disposition-card {
            min-height: 360px;
          }

          .overview-disposition-body {
            margin-top: 28px;
            display: grid;
            grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
            gap: 32px;
            align-items: center;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @media (max-width: 1180px) {
            .admin-app-shell {
              grid-template-columns: 1fr !important;
            }

            .admin-sidebar {
              border-right: 0 !important;
              border-bottom: 1px solid rgba(122, 73, 255, 0.28);
            }

            .admin-sidebar nav {
              display: flex;
              overflow-x: auto;
              padding: 0 12px 12px;
              -webkit-overflow-scrolling: touch;
            }

            .admin-sidebar nav button {
              min-width: 150px;
              border-left: 0 !important;
              border-bottom: 3px solid transparent;
              justify-content: center;
              padding: 12px 16px !important;
            }

            .admin-sidebar > div:nth-of-type(2),
            .admin-sidebar > div:nth-of-type(3) {
              display: none !important;
            }

            .admin-sidebar > button {
              margin-top: 0 !important;
              justify-content: center;
              padding: 14px 18px !important;
            }

            .admin-main {
              padding: 22px !important;
              overflow-x: hidden !important;
            }

            .admin-kpi-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .admin-two-grid,
            .admin-agent-grid,
            .admin-create-grid {
              grid-template-columns: 1fr !important;
            }

            .overview-status-bars {
              grid-template-columns: repeat(4, minmax(88px, 1fr)) !important;
              gap: 16px !important;
            }

            .overview-disposition-body {
              grid-template-columns: minmax(220px, 280px) minmax(0, 1fr) !important;
            }

            .admin-filter-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .admin-toolbar {
              align-items: stretch !important;
              flex-wrap: wrap;
            }

            .admin-toolbar-actions {
              width: 100%;
              flex-wrap: wrap;
            }

            .admin-toolbar-actions > * {
              flex: 1 1 180px;
            }
          }

          @media (max-width: 680px) {
            .admin-main {
              padding: 16px !important;
            }

            .admin-toast {
              left: 12px !important;
              right: 12px !important;
              top: 12px !important;
            }

            .admin-kpi-grid,
            .admin-filter-grid,
            .admin-mini-grid {
              grid-template-columns: 1fr !important;
            }

            .admin-agent-card {
              padding: 22px !important;
              min-height: 0 !important;
            }

            .admin-agent-header {
              grid-template-columns: 56px minmax(0, 1fr) !important;
              gap: 14px !important;
            }

            .admin-avatar {
              width: 56px !important;
              height: 56px !important;
              font-size: 20px !important;
            }

            .admin-modal {
              padding: 18px !important;
            }

            .admin-main h1 {
              font-size: 24px !important;
            }

            .admin-main input,
            .admin-main select,
            .admin-main button {
              max-width: 100%;
            }

            .overview-status-bars {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              min-height: 300px !important;
            }

            .overview-disposition-body {
              grid-template-columns: 1fr !important;
              justify-items: center;
            }
          }
        `}
      </style>

      {feedback ? (
        <div
          style={{
            position: "fixed",
            top: "18px",
            right: "18px",
            zIndex: 30,
            ...panel,
            padding: "12px 16px",
            color: "#d9b7ff",
            boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
          }}
          className="admin-toast"
        >
          {feedback}
        </div>
      ) : null}

      <div className="admin-app-shell" style={{ display: "grid", gridTemplateColumns: "294px minmax(980px, 1fr)", minHeight: "100vh" }}>
        <aside
          className="admin-sidebar"
          style={{
            background: "#080710",
            borderRight: "1px solid rgba(122, 73, 255, 0.28)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "28px", borderBottom: "1px solid rgba(122, 73, 255, 0.22)" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(145, 73, 255, 0.22)",
                    border: "1px solid rgba(177, 107, 255, 0.52)",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: "#c88cff", fontSize: "22px" }}>*</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>Dialflow.ai</div>
                  <div style={{ marginTop: "6px", color: "#a6a1bd", fontSize: "14px" }}>Powered by Dhritii.ai</div>
                </div>
              </div>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </div>

          <div style={{ padding: "24px 22px" }}>
            <div style={{ ...panel, padding: "18px", background: "#1b102d" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "999px",
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg, #b05cff, #7937f2)",
                  fontWeight: 700,
                  fontSize: "17px",
                }}
              >
                {user.name?.slice(0, 2).toUpperCase() || "AD"}
              </div>
              <div style={{ marginTop: "16px", fontSize: "18px", fontWeight: 700 }}>{user.name || "Admin"}</div>
              <div style={{ marginTop: "6px", color: "#aaa3c2" }}>{isSuperAdmin ? "Super Admin | Advanced Controls" : "Admin | Team Lead"}</div>
              <div
                style={{
                  display: "inline-flex",
                  marginTop: "14px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  color: "#ffd02d",
                  border: "1px solid rgba(255, 208, 45, 0.55)",
                  background: "rgba(255, 208, 45, 0.1)",
                }}
              >
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </div>
              {isDowntimeApprover ? (
                <button
                  type="button"
                  onClick={openDowntimeNotifications}
                  title="Open Downtime Requests"
                  style={{
                    marginTop: "14px",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255, 208, 45, 0.42)",
                    background: unreadDowntimeCount ? "rgba(255, 208, 45, 0.14)" : "rgba(255, 255, 255, 0.035)",
                    color: "#f4f0ff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <span aria-hidden="true" style={{ fontSize: "18px", lineHeight: 1 }}>!</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "14px", fontWeight: 800 }}>Downtime Alerts</span>
                      <span style={{ display: "block", marginTop: "4px", color: "#aaa3c2", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {latestDowntimeNotification?.request
                          ? `${latestDowntimeNotification.request.agentName || "Agent"} | ${latestDowntimeNotification.request.issueType}`
                          : "No new requests"}
                      </span>
                    </span>
                  </span>
                  {unreadDowntimeCount ? (
                    <span
                      style={{
                        minWidth: "24px",
                        height: "24px",
                        padding: "0 7px",
                        borderRadius: "999px",
                        display: "grid",
                        placeItems: "center",
                        background: "#ffd02d",
                        color: "#18131f",
                        fontSize: "12px",
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {unreadDowntimeCount > 9 ? "9+" : unreadDowntimeCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ padding: "16px 28px 8px", color: "#5f6076", letterSpacing: "0.08em", fontSize: "13px" }}>
            ANALYTICS
          </div>

          <nav>
            {[
              ["overview", "Overview", "grid"],
               ...(isSuperAdmin
                ? [
                    ["manage-admins", "Manage Admins", "user"],
                    ["audit-logs", "Admin History", "list"],
                  ]
                : []),
              ["analytics", "Analytics", "chart"],
              ["ranking", "Rankings", "chart"],
              ["responses", "All Responses", "list"],
              ["downtime", "Downtime Requests", "list"],
              ["downtime-history", "Downtime History", "list"],
              ["agents", "Agents", "user"],
              ["reports", "Reports", "list"],

            ].map(([id, label, icon]) => (
              <button
                type="button"
                key={label}
                className={activeView === id ? "crm-nav-item is-active" : "crm-nav-item"}
                onClick={() => handleNavClick(id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 28px",
                  border: 0,
                  borderLeft: activeView === id ? "4px solid #a855f7" : "4px solid transparent",
                  background: activeView === id ? "rgba(122, 73, 255, 0.16)" : "transparent",
                  color: activeView === id ? "#d9b7ff" : "#aeb5d4",
                  textAlign: "left",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                {iconFor(icon)}
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={openLogoutConfirmation}
            style={{
              marginTop: "auto",
              display: "flex",
              gap: "12px",
              alignItems: "center",
              padding: "24px 28px",
              border: 0,
              borderTop: "1px solid rgba(122, 73, 255, 0.22)",
              background: "transparent",
              color: "#696d84",
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            {iconFor("logout")}
            Logout
          </button>
        </aside>

        <main className="admin-main admin-scroll" style={{ padding: "32px", overflowX: "auto" }}>
          {activeView === "manage-admins" && isSuperAdmin ? (
            <>
              <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Manage Admins</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                    Admin Dashboard controls with super admin account governance
                  </div>
                </div>
                <button type="button" onClick={openCreateAdmin} style={{ ...ghostButton, background: "rgba(168, 85, 247, 0.18)", borderColor: "rgba(168, 85, 247, 0.5)" }}>
                  Create Admin
                </button>
              </div>

              <section className="admin-kpi-grid" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {[
                  ["TOTAL ADMINS", managedAdminSummary.totalAdmins, "Admin accounts", "#a855f7"],
                  ["ACTIVE ADMINS", managedAdminSummary.activeAdmins, "Currently online", "#35e5a7"],
                  ["TOTAL AGENTS", managedAdminSummary.totalAgents, "Managed users", "#27d8ff"],
                  ["ONLINE AGENTS", managedAdminSummary.onlineAgents, "Live agent sessions", "#ffd02d"],
                ].map(([title, value, note, accent]) => (
                  <article key={title} className="admin-hover-card" style={{ ...panel, padding: "22px 24px", borderTop: `3px solid ${accent}`, minHeight: "150px" }}>
                    <div style={{ color: "#8f98b7", fontSize: "15px", lineHeight: 1.08 }}>{title}</div>
                    <div style={{ marginTop: "14px", color: accent, fontSize: "34px", lineHeight: 1 }}>{value}</div>
                    <div style={{ marginTop: "12px", color: "#9da6c3", fontSize: "14px" }}>{note}</div>
                  </article>
                ))}
              </section>

              <section className="admin-agent-grid" style={{ marginTop: "34px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "22px" }}>
                {managedAdmins.map((admin) => {
                  const tone = statusTone(admin.status);
                  return (
                    <article key={admin.id} className="admin-hover-card" style={{ ...panel, padding: "26px", minHeight: "260px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <h2 style={{ margin: 0, fontSize: "22px" }}>{admin.name}</h2>
                          <div style={{ marginTop: "8px", color: "#8f98b7" }}>{admin.employeeId}</div>
                        </div>
                        <span style={{ padding: "7px 12px", borderRadius: "999px", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, fontSize: "12px", fontWeight: 800 }}>
                          {admin.status}
                        </span>
                      </div>
                      <div className="admin-mini-grid" style={{ marginTop: "22px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                        {[
                          ["Email", admin.email || "NA"],
                          ["Role", admin.role],
                          ["Created", formatDateTime(admin.createdAt)],
                          ["Last Active", formatDateTime(admin.lastActiveAt)],
                        ].map(([label, value]) => (
                          <div key={label} style={{ border: "1px solid rgba(122, 73, 255, 0.22)", borderRadius: "12px", padding: "12px", background: "rgba(255,255,255,0.025)" }}>
                            <div style={{ color: "#7d849f", fontSize: "12px" }}>{label}</div>
                            <div style={{ marginTop: "6px", color: "#f4f0ff", fontSize: "14px", overflowWrap: "anywhere" }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: "22px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => openEditAdmin(admin)} style={{ ...ghostButton, padding: "10px 14px", fontSize: "14px" }}>Edit</button>
                        <button type="button" onClick={() => deleteManagedAdminAccount(admin)} style={{ ...ghostButton, padding: "10px 14px", fontSize: "14px", color: "#ff7685", borderColor: "rgba(255, 118, 133, 0.42)" }}>Delete</button>
                        <button type="button" onClick={() => forceLogoutManagedAdminAccount(admin)} style={{ ...ghostButton, padding: "10px 14px", fontSize: "14px", color: "#ffb45c", borderColor: "rgba(255, 180, 92, 0.42)" }}>Force Logout</button>
                      </div>
                    </article>
                  );
                })}
                {!managedAdmins.length ? (
                  <div className="admin-empty-state" style={{ ...panel, padding: "24px" }}>No admins found.</div>
                ) : null}
              </section>
            </>
          ) : activeView === "audit-logs" && isSuperAdmin ? (
            <>
              <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Admin History</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                    Enterprise activity trail for protected admin operations
                  </div>
                </div>
                <div className="admin-toolbar-actions" style={{ display: "flex", gap: "12px" }}>
                  <button type="button" onClick={exportAuditLogsCsv} style={ghostButton}>CSV Download</button>
                  <button type="button" onClick={exportAuditLogsPdf} style={ghostButton}>PDF Download</button>
                </div>
              </div>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "24px" }}>
                <div className="admin-filter-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" }}>
                  <input style={input} type="date" value={auditFilters.startDate} onChange={(event) => setAuditFilters((current) => ({ ...current, startDate: event.target.value }))} aria-label="Start Date" />
                  <input style={input} type="date" value={auditFilters.endDate} onChange={(event) => setAuditFilters((current) => ({ ...current, endDate: event.target.value }))} aria-label="End Date" />
                  <select className="admin-select" style={input} value={auditFilters.admin} onChange={(event) => setAuditFilters((current) => ({ ...current, admin: event.target.value }))}>
                    <option value="all">Admin Filter</option>
                    {auditAdminOptions.map((admin) => <option key={admin} value={admin}>{admin}</option>)}
                  </select>
                  <select className="admin-select" style={input} value={auditFilters.action} onChange={(event) => setAuditFilters((current) => ({ ...current, action: event.target.value }))}>
                    <option value="all">Action Filter</option>
                    {auditActionOptions.map((action) => <option key={action} value={action}>{formatAuditAction(action)}</option>)}
                  </select>
                </div>
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "28px", padding: "26px", overflowX: "auto" }}>
                <table className="admin-polished-table" style={{ width: "100%", minWidth: "920px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#8f98b7", textAlign: "left", fontSize: "13px" }}>
                      {["Admin Name", "Action", "Target", "Date", "Time"].map((header) => (
                        <th key={header} style={{ padding: "14px 12px", borderBottom: "1px solid rgba(122,73,255,0.22)" }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ padding: "15px 12px", borderBottom: "1px solid rgba(122,73,255,0.16)" }}>{log.adminName}</td>
                        <td style={{ padding: "15px 12px", borderBottom: "1px solid rgba(122,73,255,0.16)", color: "#d9b7ff" }}>{log.actionLabel || formatAuditAction(log.action)}</td>
                        <td style={{ padding: "15px 12px", borderBottom: "1px solid rgba(122,73,255,0.16)", color: "#cdd3ea" }}>{log.target || "NA"}</td>
                        <td style={{ padding: "15px 12px", borderBottom: "1px solid rgba(122,73,255,0.16)" }}>{formatReportDateOnly(log.createdAt)}</td>
                        <td style={{ padding: "15px 12px", borderBottom: "1px solid rgba(122,73,255,0.16)" }}>{formatTimeOnly(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!auditLogs.length ? <div className="admin-empty-state" style={{ marginTop: "18px" }}>No Admin History match these filters.</div> : null}
              </section>
            </>
          ) : activeView === "ranking" ? (
            <AdminRanking token={token} />
          ) : activeView === "analytics" ? (
            <>
              <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Analytics</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                    Detailed performance insights | All agents
                  </div>
                </div>
                <div className="admin-toolbar-actions" style={{ display: "flex", gap: "12px" }}>
                  {/* <select className="admin-select" style={{ ...input, width: "190px" }} defaultValue="today">
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                  </select> */}
                  <button type="button" onClick={() => downloadResponsesExport(token)} style={ghostButton}>
                    Export
                  </button>
                </div>
              </div>

              <section className="admin-kpi-grid" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {[
                  ["TOTAL CALLS", analytics.totalCalls, "5.2% vs yesterday", "#a855f7"],
                  ["CONNECT RATE", `${analytics.connectRate}%`, "1.4% vs yesterday", "#27d8ff"],
                  ["CONVERSION RATE", `${analytics.conversionRate}%`, "0.8% vs yesterday", "#35e5a7"],
                  ["AVG CALLS/AGENT", avgCallsPerAgent, "2 vs yesterday", "#ffd02d"],
                ].map(([title, value, note, accent], index) => (
                  <article key={title} style={{ ...panel, padding: "22px 24px", borderTop: `3px solid ${accent}`, minHeight: "170px" }}>
                    <div style={{ color: "#8f98b7", fontSize: "15px", lineHeight: 1.08 }}>{title}</div>
                    <div style={{ marginTop: "14px", color: accent, fontSize: "34px", lineHeight: 1 }}>{value}</div>
                    <div style={{ marginTop: "12px", color: index === 3 ? "#ff7685" : "#26e6ad", fontSize: "14px" }}>
                      {index === 3 ? "down " : "up "}
                      {note}
                    </div>
                  </article>
                ))}
              </section>

              <section className="admin-kpi-grid" style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                {[
                  ["PEAK HOUR", "11 AM", `${Math.max(analytics.connectedCalls, analytics.notConnectedCalls)} calls in that hour`, "#8b5cf6"],
                  ["TOP DISPOSITION", topDisposition.label, `${topDisposition.value} calls`, "#26e6ad"],
                  ["TOP LANGUAGE", topLanguage.label, `${topLanguage.value} calls`, "#ffd02d"],
                ].map(([label, value, note, accent]) => (
                  <article key={label} style={{ ...panel, padding: "22px", minHeight: "170px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "12px", display: "grid", placeItems: "center", background: `${accent}22`, color: accent, fontSize: "22px" }}>
                      {label === "PEAK HOUR" ? "◷" : label === "TOP DISPOSITION" ? "⌁" : "◴"}
                    </div>
                    <div style={{ marginTop: "16px", color: "#8f98b7", fontSize: "15px" }}>{label}</div>
                    <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 600 }}>{value}</div>
                    <div style={{ marginTop: "8px", color: "#596078" }}>{note}</div>
                  </article>
                ))}
              </section>

              <section style={{ ...panel, marginTop: "30px", padding: "28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0, fontSize: "19px" }}>Call volume trend</h2>
                  <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                    Hourly | Today
                  </span>
                </div>
                <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                <div style={{ marginTop: "22px", display: "flex", gap: "20px", color: "#aeb5d4" }}>
                  <span><b style={{ color: "#a855f7" }}>■</b> Total calls</span>
                  <span><b style={{ color: "#35e5a7" }}>■</b> Connected</span>
                </div>
                <svg viewBox="0 0 860 330" style={{ width: "100%", marginTop: "16px" }}>
                  {[0, 1, 2, 3, 4, 5].map((line) => (
                    <line key={line} x1="50" x2="820" y1={40 + line * 46} y2={40 + line * 46} stroke="rgba(132, 80, 255, 0.18)" />
                  ))}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((line) => (
                    <line key={line} x1={60 + line * 92} x2={60 + line * 92} y1="40" y2="270" stroke="rgba(132, 80, 255, 0.12)" />
                  ))}
                  <path d="M60 220 L150 150 L245 76 L335 120 L425 188 L515 130 L605 95 L695 140 L790 170" fill="rgba(157, 78, 255, 0.12)" stroke="#a855f7" strokeWidth="4" />
                  <path d="M60 238 L150 188 L245 142 L335 178 L425 220 L515 172 L605 154 L695 190 L790 202" fill="none" stroke="#35e5a7" strokeWidth="4" strokeDasharray="8 8" />
                  {[60, 150, 245, 335, 425, 515, 605, 695, 790].map((x, index) => (
                    <circle key={`total-${x}`} cx={x} cy={[220, 150, 76, 120, 188, 130, 95, 140, 170][index]} r="6" fill="#a855f7" />
                  ))}
                  {[60, 150, 245, 335, 425, 515, 605, 695, 790].map((x, index) => (
                    <circle key={`conn-${x}`} cx={x} cy={[238, 188, 142, 178, 220, 172, 154, 190, 202][index]} r="6" fill="#35e5a7" />
                  ))}
                  {["9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM"].map((label, index) => (
                    <text key={label} x={45 + index * 92} y="305" fill="#596078" fontSize="15" fontWeight="700">{label}</text>
                  ))}
                </svg>
              </section>

              <section className="admin-two-grid" style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "18px" }}>
                <article style={{ ...panel, padding: "28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ margin: 0, fontSize: "19px" }}>Disposition breakdown</h2>
                    <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                      Connected calls only
                    </span>
                  </div>
                  <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                  <div style={{ marginTop: "24px", display: "flex", gap: "20px", flexWrap: "wrap", color: "#aeb5d4" }}>
                    {dispositionBreakdown.slice(0, 4).map((item, index) => (
                      <span key={item.label}>
                        <b style={{ color: ["#35e5a7", "#a855f7", "#ff717e", "#27d8ff"][index] }}>■</b> {item.label} {item.value}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: "34px", display: "grid", placeItems: "center" }}>
                    <div style={{ width: "300px", height: "300px", borderRadius: "999px", background: "conic-gradient(#35e5a7 0 22%, #a855f7 22% 55%, #ff717e 55% 78%, #27d8ff 78% 100%)", display: "grid", placeItems: "center" }}>
                      <div style={{ width: "160px", height: "160px", borderRadius: "999px", background: "#121027" }} />
                    </div>
                  </div>
                </article>

                <article style={{ ...panel, padding: "28px" }}>
                  <h2 style={{ margin: 0, fontSize: "19px" }}>Call status by day</h2>
                  <div style={{ marginTop: "22px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                  <div style={{ marginTop: "34px", display: "flex", alignItems: "end", gap: "32px", height: "300px", paddingLeft: "30px" }}>
                    {["Mon", "Tue", "Wed", "Thu"].map((day, index) => (
                      <div key={day} style={{ width: "58px", display: "grid", gap: "8px", justifyItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "end", height: "230px", width: "48px", background: "#3e485b", borderRadius: "5px 5px 0 0", overflow: "hidden" }}>
                          <div style={{ width: "100%", height: `${55 + index * 8}%`, background: "#7c34f2" }} />
                        </div>
                        <span style={{ color: "#596078", fontWeight: 700 }}>{day}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="admin-two-grid" style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "18px" }}>
                <article style={{ ...panel, padding: "28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ margin: 0, fontSize: "19px" }}>Sub-disposition breakdown</h2>
                    <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                      Call Back reasons
                    </span>
                  </div>
                  <div style={{ marginTop: "22px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                  <div style={{ marginTop: "28px", display: "grid", gap: "18px" }}>
                    {subDispositionBreakdown.slice(0, 6).map((item) => (
                      <div key={item.label} style={{ display: "grid", gridTemplateColumns: "240px 1fr 38px", gap: "16px", alignItems: "center" }}>
                        <div style={{ color: "#7d849f", textAlign: "right" }}>{item.label}</div>
                        <div style={{ height: "30px", borderRadius: "6px", background: "rgba(132, 80, 255, 0.12)" }}>
                          <div style={{ width: `${Math.max((item.value / maxSubDisposition) * 100, 6)}%`, height: "100%", borderRadius: "6px", background: "linear-gradient(90deg, #7c34f2, #a855f7)" }} />
                        </div>
                        <div style={{ color: "#596078" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </article>

                <article style={{ ...panel, padding: "28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ margin: 0, fontSize: "19px", lineHeight: 1.1 }}>Language distribution</h2>
                    <span style={{ padding: "10px 14px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                      All Calls
                    </span>
                  </div>
                  <div style={{ marginTop: "22px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                  <div style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
                    {languageBreakdown.slice(0, 8).map((item) => (
                      <div key={item.label} style={{ display: "grid", gridTemplateColumns: "100px 1fr 34px", gap: "12px", alignItems: "center" }}>
                        <div style={{ color: "#aeb5d4" }}>{item.label}</div>
                        <div style={{ height: "3px", background: "rgba(132, 80, 255, 0.18)" }}>
                          <div style={{ width: `${Math.max((item.value / Math.max(analytics.totalCalls, 1)) * 100, 4)}%`, height: "100%", background: "#a855f7" }} />
                        </div>
                        <div style={{ color: "#596078", textAlign: "right" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            </>
          ) : activeView === "responses" ? (
            <>
              <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>All Responses</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                    Complete call log | Sortable | Filterable
                  </div>
                </div>
                <button type="button" onClick={() => downloadResponsesExport(token)} style={{ ...ghostButton, fontSize: "22px", padding: "16px 28px" }}>
                  Export CSV
                </button>
              </div>

              <section className="admin-kpi-grid" style={{ marginTop: "34px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "18px" }}>
                {[
                  ["TOTAL", analytics.totalCalls, "#c681ff"],
                  ["CONNECTED", analytics.connectedCalls, "#27d8ff"],
                  ["POSITIVE", analytics.positiveCalls, "#35e5a7"],
                  ["NOT CONNECTED", analytics.notConnectedCalls, "#ff717e"],
                  ["CALL BACK", responses.filter((item) => item.disposition === "Call Back").length, "#ffd02d"],
                ].map(([title, value, accent]) => (
                  <article key={title} style={{ ...panel, padding: "24px 26px", minHeight: "145px", borderTop: `3px solid ${accent}` }}>
                    <div style={{ color: "#8f98b7", fontSize: "17px", lineHeight: 1.08 }}>{title}</div>
                    <div style={{ marginTop: "16px", color: accent, fontSize: "34px", lineHeight: 1 }}>{value}</div>
                  </article>
                ))}
              </section>

              <section style={{ ...panel, marginTop: "36px", padding: "34px 36px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0, fontSize: "22px" }}>Response log</h2>
                  <span style={{ padding: "8px 18px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)", fontSize: "18px" }}>
                    {responsePagination.total} records
                  </span>
                </div>
                <div style={{ marginTop: "24px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />

                <div style={{ marginTop: "28px", display: "grid", gap: "14px" }}>
                  <input
                    style={{ ...input, fontSize: "24px", padding: "16px 20px" }}
                    placeholder="Search employee name or Ref ID..."
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setResponsePage(1);
                    }}
                  />
                  <input
                    type="date"
                    style={{ ...input, fontSize: "24px", padding: "16px 20px" }}
                    value={dateFilter}
                    onChange={(event) => {
                      setDateFilter(event.target.value);
                      setResponsePage(1);
                    }}
                  />
                  <input
                    style={{ ...input, fontSize: "24px", padding: "16px 20px" }}
                    placeholder="Employee name"
                    value={employeeNameFilter}
                    onChange={(event) => {
                      setEmployeeNameFilter(event.target.value);
                      setResponsePage(1);
                    }}
                  />
                  <input
                    style={{ ...input, fontSize: "24px", padding: "16px 20px" }}
                    placeholder="Reference ID"
                    value={referenceIdFilter}
                    onChange={(event) => {
                      setReferenceIdFilter(event.target.value);
                      setResponsePage(1);
                    }}
                  />
                  <select className="admin-select" style={{ ...input, fontSize: "24px", padding: "16px 20px" }} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setResponsePage(1); }}>
                    <option value="all">All status</option>
                    <option value="Connected">Connected</option>
                    <option value="Not Connected">Not Connected</option>
                  </select>
                  <select className="admin-select" style={{ ...input, fontSize: "24px", padding: "16px 20px" }} value={dispositionFilter} onChange={(event) => { setDispositionFilter(event.target.value); setResponsePage(1); }}>
                    <option value="all">All dispositions</option>
                    {dispositions.map((disposition) => (
                      <option key={disposition} value={disposition}>{disposition}</option>
                    ))}
                  </select>
                  <select className="admin-select" style={{ ...input, fontSize: "24px", padding: "16px 20px" }} value={agentFilter} onChange={(event) => { setAgentFilter(event.target.value); setResponsePage(1); }}>
                    <option value="all">All agents</option>
                    {agents.map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                  <select className="admin-select" style={{ ...input, fontSize: "24px", padding: "16px 20px" }} value={languageFilter} onChange={(event) => { setLanguageFilter(event.target.value); setResponsePage(1); }}>
                    <option value="all">All languages</option>
                    {languageBreakdown.map((language) => (
                      <option key={language.label} value={language.label}>{language.label}</option>
                    ))}
                  </select>
                  <select className="admin-select" style={{ ...input, fontSize: "24px", padding: "16px 20px" }} value={responsePageSize} onChange={(event) => { setResponsePageSize(Number(event.target.value)); setResponsePage(1); }}>
                    <option value={10}>10 rows</option>
                    <option value={25}>25 rows</option>
                    <option value={50}>50 rows</option>
                  </select>
                  <button type="button" onClick={clearResponseFilters} style={{ ...ghostButton, justifySelf: "start", fontSize: "20px", padding: "13px 28px" }}>
                    Clear
                  </button>
                </div>

                <div className="admin-scroll" style={{ marginTop: "24px", overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: "1050px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#5f637d", textAlign: "left", fontSize: "15px", letterSpacing: "0.06em" }}>
                        {["#REF ID ↕", "AGENT ↕", "STATUS ↕", "DISPOSITION ↕", "SUB-DISP", "LANGUAGE"].map((heading) => (
                          <th key={heading} style={{ padding: "15px 14px", borderBottom: "1px solid rgba(122, 73, 255, 0.28)" }}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedResponses.map((item) => {
                        const tone = statusTone(item.call_status);
                        const dispositionTone = statusTone(item.disposition === "Call Back" ? "Call Back" : item.call_status);

                        return (
                          <tr key={item.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                            <td style={{ padding: "17px 14px", color: "#c681ff", fontSize: "18px" }}>{item.reference_id}</td>
                            <td style={{ padding: "17px 14px", fontWeight: 700 }}>{item.employee_name}</td>
                            <td style={{ padding: "17px 14px" }}>
                              <span style={{ display: "inline-flex", padding: "7px 16px", borderRadius: "999px", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}>
                                {item.call_status}
                              </span>
                            </td>
                            <td style={{ padding: "17px 14px" }}>
                              <span style={{ display: "inline-flex", padding: "7px 16px", borderRadius: "999px", color: item.disposition === "Call Back" ? "#ffd02d" : dispositionTone.color, background: item.disposition === "Call Back" ? "rgba(255, 208, 45, 0.12)" : dispositionTone.bg, border: `1px solid ${item.disposition === "Call Back" ? "rgba(255, 208, 45, 0.34)" : dispositionTone.border}` }}>
                                {item.disposition}
                              </span>
                            </td>
                            <td style={{ padding: "17px 14px", color: "#aeb5d4" }}>{item.sub_disposition || "NA"}</td>
                            <td style={{ padding: "17px 14px", color: "#aeb5d4" }}>{item.language === "Other" ? item.language_other || "Other" : item.language}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: "30px", borderTop: "1px solid rgba(122, 73, 255, 0.24)" }} />
                <div style={{ marginTop: "28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
                  <div style={{ color: "#596078", fontSize: "18px" }}>
                    Showing {responsePagination.total ? (currentResponsePage - 1) * responsePageSize + 1 : 0}-{Math.min(currentResponsePage * responsePageSize, responsePagination.total)} of {responsePagination.total}
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button type="button" disabled={currentResponsePage === 1} onClick={() => setResponsePage((page) => Math.max(page - 1, 1))} style={{ ...ghostButton, opacity: currentResponsePage === 1 ? 0.45 : 1, minWidth: "140px" }}>
                      ← Prev
                    </button>
                    {Array.from({ length: totalResponsePages }).slice(0, 4).map((_, index) => (
                      <button key={index + 1} type="button" onClick={() => setResponsePage(index + 1)} style={{ ...ghostButton, background: currentResponsePage === index + 1 ? "rgba(122, 73, 255, 0.18)" : "transparent", minWidth: "66px" }}>
                        {index + 1}
                      </button>
                    ))}
                    <button type="button" disabled={currentResponsePage === totalResponsePages} onClick={() => setResponsePage((page) => Math.min(page + 1, totalResponsePages))} style={{ ...ghostButton, opacity: currentResponsePage === totalResponsePages ? 0.45 : 1, minWidth: "140px" }}>
                      Next →
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : activeView === "downtime" ? (
            <>
              <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Downtime Requests</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                    System issue approvals | Separate from break management
                  </div>
                </div>
                <button type="button" onClick={loadDowntimeRequests} disabled={isDowntimeLoading} style={ghostButton}>
                  {isDowntimeLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <section className="admin-kpi-grid" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {[
                  ["PENDING", pendingDowntimeRequests.length, "#ffd02d"],
                  ["ACTIVE", activeDowntimeRequests.length, "#27d8ff"],
                  ["RESOLVED", downtimeRequests.filter((item) => item.status === "resolved").length, "#35e5a7"],
                  ["REJECTED", downtimeRequests.filter((item) => item.status === "rejected").length, "#ff7685"],
                ].map(([title, value, accent]) => (
                  <article key={title} style={{ ...panel, padding: "22px 24px", borderTop: `3px solid ${accent}`, minHeight: "140px" }}>
                    <div style={{ color: "#8f98b7", fontSize: "15px" }}>{title}</div>
                    <div style={{ marginTop: "14px", color: accent, fontSize: "38px", lineHeight: 1 }}>{value}</div>
                  </article>
                ))}
              </section>

              <section style={{ ...panel, marginTop: "30px", padding: "26px", overflowX: "auto" }}>
                <h2 style={{ margin: 0, fontSize: "22px" }}>Pending Requests</h2>
                <table className="admin-polished-table" style={{ width: "100%", minWidth: "1120px", marginTop: "20px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                      {["AGENT NAME", "EMPLOYEE ID", "DATE", "ISSUE TYPE", "COMMENT", "REQUESTED AT", "STATUS", "ACTIONS"].map((heading) => (
                        <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDowntimeRequests.map((request) => (
                      <tr key={request.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                        <td style={{ padding: "14px 12px" }}>{request.agentName}</td>
                        <td style={{ padding: "14px 12px" }}>{request.employeeId}</td>
                        <td style={{ padding: "14px 12px" }}>{formatReportDateOnly(request.requestedAt)}</td>
                        <td style={{ padding: "14px 12px", color: "#9bdcff" }}>{request.issueType}</td>
                        <td style={{ padding: "14px 12px", maxWidth: "300px", color: "#cdd3ea" }}>{request.comment}</td>
                        <td style={{ padding: "14px 12px" }}>{formatDateTime(request.requestedAt)}</td>
                        <td style={{ padding: "14px 12px", color: "#ffd02d" }}>{request.status}</td>
                        <td style={{ padding: "14px 12px" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button type="button" onClick={() => handleDowntimeAction(request, "approve")} disabled={downtimeActionId === request.id} style={{ ...ghostButton, padding: "8px 12px", fontSize: "14px", color: "#35e5a7", borderColor: "rgba(53, 229, 167, 0.42)" }}>
                              Approve
                            </button>
                            <button type="button" onClick={() => handleDowntimeAction(request, "reject")} disabled={downtimeActionId === request.id} style={{ ...ghostButton, padding: "8px 12px", fontSize: "14px", color: "#ff7685", borderColor: "rgba(255, 118, 133, 0.42)" }}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!pendingDowntimeRequests.length ? (
                      <tr>
                        <td colSpan="8" style={{ padding: "22px 12px" }}>
                          <div className="admin-empty-state">No pending downtime requests.</div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>

              <section style={{ ...panel, marginTop: "30px", padding: "26px", overflowX: "auto" }}>
                <h2 style={{ margin: 0, fontSize: "22px" }}>Active Downtime</h2>
                <table className="admin-polished-table" style={{ width: "100%", minWidth: "980px", marginTop: "20px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                      {["AGENT NAME", "EMPLOYEE ID", "ISSUE TYPE", "START TIME", "RUNNING DURATION", "STATUS", "ACTION"].map((heading) => (
                        <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDowntimeRequests.map((request) => (
                      <tr key={request.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                        <td style={{ padding: "14px 12px" }}>{request.agentName}</td>
                        <td style={{ padding: "14px 12px" }}>{request.employeeId}</td>
                        <td style={{ padding: "14px 12px", color: "#9bdcff" }}>{request.issueType}</td>
                        <td style={{ padding: "14px 12px" }}>{formatDateTime(request.approvedAt)}</td>
                        <td style={{ padding: "14px 12px", color: "#27d8ff" }}>{formatDurationHuman(request.runningDurationSeconds)}</td>
                        <td style={{ padding: "14px 12px", color: "#27d8ff" }}>{request.status}</td>
                        <td style={{ padding: "14px 12px" }}>
                          <button type="button" onClick={() => handleDowntimeAction(request, "resolve")} disabled={downtimeActionId === request.id} style={{ ...ghostButton, padding: "8px 12px", fontSize: "14px", color: "#ffb45c", borderColor: "rgba(255, 180, 92, 0.42)" }}>
                            Resolve / Stop Downtime
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!activeDowntimeRequests.length ? (
                      <tr>
                        <td colSpan="7" style={{ padding: "22px 12px" }}>
                          <div className="admin-empty-state">No active downtime.</div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
            </>
          ) : activeView === "downtime-history" ? (
            <>
              <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Downtime History</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                    Filtered downtime records | All agents
                  </div>
                </div>
                <button type="button" onClick={loadDowntimeHistoryRows} disabled={isDowntimeHistoryLoading} style={ghostButton}>
                  {isDowntimeHistoryLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "28px", padding: "24px" }}>
                <div className="admin-filter-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "14px" }}>
                  <input style={input} type="date" value={downtimeHistoryDateFrom} onChange={(event) => setDowntimeHistoryDateFrom(event.target.value)} aria-label="Date From" />
                  <input style={input} type="date" value={downtimeHistoryDateTo} onChange={(event) => setDowntimeHistoryDateTo(event.target.value)} aria-label="Date To" />
                  <select className="admin-select" style={input} value={downtimeHistoryAgent} onChange={(event) => setDowntimeHistoryAgent(event.target.value)}>
                    <option value="all">All agents</option>
                    {downtimeHistoryAgentOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select className="admin-select" style={input} value={downtimeHistoryStatus} onChange={(event) => setDowntimeHistoryStatus(event.target.value)}>
                    <option value="all">All status</option>
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved / Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select className="admin-select" style={input} value={downtimeHistoryIssueType} onChange={(event) => setDowntimeHistoryIssueType(event.target.value)}>
                    <option value="all">All issue types</option>
                    {downtimeIssueTypes.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="admin-kpi-grid" style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "16px" }}>
                {[
                  ["Total Requests", downtimeHistorySummary.total, "#c681ff"],
                  ["Pending", downtimeHistorySummary.pending, "#ffd02d"],
                  ["Approved", downtimeHistorySummary.approved, "#27d8ff"],
                  ["Resolved", downtimeHistorySummary.resolved, "#35e5a7"],
                  ["Rejected", downtimeHistorySummary.rejected, "#ff7685"],
                ].map(([title, value, accent]) => (
                  <article key={title} style={{ ...panel, padding: "20px 22px", minHeight: "138px", borderTop: `3px solid ${accent}` }}>
                    <div style={{ color: "#8f98b7", fontSize: "14px", lineHeight: 1.1 }}>{title}</div>
                    <div style={{ marginTop: "14px", color: accent, fontSize: "32px", lineHeight: 1 }}>{value}</div>
                  </article>
                ))}
              </section>

              <section style={{ ...panel, marginTop: "30px", padding: "26px", overflowX: "auto" }}>
                <table className="admin-polished-table" style={{ width: "100%", minWidth: "1280px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                      {["AGENT NAME", "EMPLOYEE ID", "DATE", "ISSUE TYPE", "COMMENT", "STATUS", "REQUESTED TIME", "APPROVED TIME", "END TIME", "DURATION"].map((heading) => (
                        <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isDowntimeHistoryLoading ? (
                      <tr>
                        <td colSpan="10" style={{ padding: "24px 12px" }}>
                          <div className="admin-empty-state">Loading downtime history...</div>
                        </td>
                      </tr>
                    ) : downtimeHistoryRecords.length ? (
                      downtimeHistoryRecords.map((item) => {
                        const tone = statusTone(item.status);

                        return (
                          <tr key={item.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                            <td style={{ padding: "14px 12px" }}>{item.agentName || "NA"}</td>
                            <td style={{ padding: "14px 12px" }}>{item.employeeId || "NA"}</td>
                            <td style={{ padding: "14px 12px" }}>{formatReportDateOnly(item.requestedAt)}</td>
                            <td style={{ padding: "14px 12px", color: "#9bdcff" }}>{item.issueType || "NA"}</td>
                            <td style={{ padding: "14px 12px", maxWidth: "280px", color: "#cdd3ea" }}>{item.comment || "NA"}</td>
                            <td style={{ padding: "14px 12px" }}>
                              <span style={{ display: "inline-flex", padding: "6px 12px", borderRadius: "999px", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}>
                                {item.status || "NA"}
                              </span>
                            </td>
                            <td style={{ padding: "14px 12px" }}>{formatTimeOnly(item.requestedTime || item.requestedAt)}</td>
                            <td style={{ padding: "14px 12px" }}>{formatTimeOnly(item.approvedTime || item.approvedAt)}</td>
                            <td style={{ padding: "14px 12px" }}>{formatTimeOnly(item.endTime || item.resolvedAt)}</td>
                            <td style={{ padding: "14px 12px", color: "#35e5a7" }}>{formatDurationHuman(getDowntimeDurationSeconds(item))}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="10" style={{ padding: "22px 12px" }}>
                          <div className="admin-empty-state">No downtime rows match these filters.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          ) : activeView === "agents" ? (
            <>
              <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Agents</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px", lineHeight: 1.15 }}>
                    Performance overview |<br /> All team members
                  </div>
                </div>
                <div className="admin-toolbar-actions" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    style={{ ...input, width: "170px", fontSize: "22px", padding: "15px 18px" }}
                    placeholder="Search agent..."
                    value={agentSearch}
                    onChange={(event) => setAgentSearch(event.target.value)}
                  />
                  <select
                    className="admin-select"
                    style={{ ...input, width: "170px", fontSize: "22px", padding: "15px 18px" }}
                    value={agentStatusFilter}
                    onChange={(event) => setAgentStatusFilter(event.target.value)}
                  >
                    <option value="all">All status</option>
                    <option value="online">online</option>
                    <option value="break">break</option>
                    <option value="offline">offline</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setForceLogoutTarget({ type: "all" })}
                    disabled={!agentCards.some((agent) => agent.status !== "offline")}
                    style={{
                      ...ghostButton,
                      padding: "15px 18px",
                      fontSize: "18px",
                      color: "#ffb45c",
                      borderColor: "rgba(255, 180, 92, 0.42)",
                      background: "rgba(255, 180, 92, 0.1)",
                      opacity: agentCards.some((agent) => agent.status !== "offline") ? 1 : 0.5,
                    }}
                  >
                    Logout All Agents
                  </button>
                  <div style={{ ...panel, display: "flex", padding: "6px", borderRadius: "16px", gap: "6px" }}>
                    {["grid", "table"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAgentViewMode(mode)}
                        style={{
                          padding: "14px 28px",
                          borderRadius: "12px",
                          border: "1px solid rgba(154, 145, 176, 0.34)",
                          background: agentViewMode === mode ? "rgba(122, 73, 255, 0.18)" : "transparent",
                          color: "#f4f0ff",
                          fontSize: "20px",
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <section className="admin-kpi-grid" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px" }}>
                {[
                  ["TOTAL AGENTS", agentCards.length, "#c681ff"],
                  ["ONLINE NOW", agentCards.filter((agent) => agent.status === "online").length, "#35e5a7"],
                  ["TODAY OFFLINE", agentCards.filter((agent) => agent.status === "offline").length, "#ff7685"],
                  ["AGENTS ON BREAK", agentCards.filter((agent) => agent.status === "break").length, "#ffa500"],
                ].map(([title, value, accent]) => (
                  <article key={title} style={{ ...panel, padding: "26px 28px", minHeight: "150px", borderTop: `3px solid ${accent}` }}>
                    <div style={{ color: "#8f98b7", fontSize: "18px", lineHeight: 1.08 }}>{title}</div>
                    <div style={{ marginTop: "18px", color: accent, fontSize: typeof value === "number" ? "38px" : "28px", lineHeight: 1 }}>
                      {value}
                    </div>
                  </article>
                ))}
              </section>

              {agentViewMode === "grid" ? (
                <section className="admin-agent-grid" style={{ marginTop: "34px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "22px" }}>
                  {filteredAgentCards.length ? (
                    filteredAgentCards.map((agent) => (
                      <article className="admin-agent-card" key={agent.dbId} style={{ ...panel, padding: "36px", minHeight: "420px" }}>
                        <div className="admin-agent-header" style={{ display: "grid", gridTemplateColumns: "78px 1fr", gap: "20px", alignItems: "center" }}>
                          <div
                            className="admin-avatar"
                            style={{
                              width: "78px",
                              height: "78px",
                              borderRadius: "999px",
                              display: "grid",
                              placeItems: "center",
                              background: agent.color,
                              fontSize: "26px",
                              fontWeight: 700,
                            }}
                          >
                            {agent.initials}
                          </div>
                          <div>
                            <div style={{ fontSize: "26px", fontWeight: 700 }}>{agent.name}</div>
                            <div style={{ marginTop: "8px", color: "#5f667f", fontSize: "17px" }}>
                              {agent.id} | {agent.zohoId}
                            </div>
                            <div style={{ 
                              marginTop: "8px", 
                              color: agent.status === "online" ? "#35e5a7" : agent.status === "break" ? "#ffa500" : "#ff7685", 
                              fontSize: "17px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                            }}>
                              <span style={{ 
                                width: "8px", 
                                height: "8px", 
                                borderRadius: "50%", 
                                background: agent.status === "online" ? "#35e5a7" : agent.status === "break" ? "#ffa500" : "#ff7685",
                                boxShadow: agent.status === "online" ? "0 0 10px rgba(53, 229, 167, 0.4)" : "none"
                              }} />
                              {displayAgentStatus(agent.status)}
                            </div>
                            <div style={{ marginTop: "8px", color: "#737b98", fontSize: "15px" }}>
                              Login {formatDateTime(agent.loginTime)} | Sessions {agent.activeSessionCount}
                            </div>
                            {agent.status === "break" && agent.breakReason ? (
                              <div title={agent.breakRemark || agent.breakReason} style={{ marginTop: "8px", color: "#ffcf8a", fontSize: "15px", lineHeight: 1.35 }}>
                                {agent.breakReason}
                                {agent.breakRemark ? (
                                  <span style={{ color: "#8f98b7" }}> | {agent.breakRemark}</span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ marginTop: "34px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
                          {[
                            ["CALLS", agent.calls, "#c681ff"],
                            ["CONNECTED", agent.connected, "#27d8ff"],
                            ["POSITIVE", agent.positive, "#35e5a7"],
                          ].map(([label, value, color]) => (
                            <div key={label} style={{ background: "rgba(255,255,255,0.035)", borderRadius: "12px", padding: "17px 12px", textAlign: "center" }}>
                              <div style={{ color, fontSize: "28px" }}>{value}</div>
                              <div style={{ marginTop: "8px", color: "#596078", fontSize: "15px", letterSpacing: "0.06em" }}>{label}</div>
                            </div>
                          ))}
                        </div>

                        <div className="admin-mini-grid" style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                          {[
                            ["STAFF TIME", formatDuration(agent.totalLoginDuration), "#9bdcff"],
                            ["TOTAL LOGIN", formatDuration(agent.staffTimeDuration), "#35e5a7"],
                            ["BREAKS", agent.breakCount, "#ffa500"],
                            ["BREAK TIME", formatDuration(agent.totalBreakDuration), "#ffb45c"],
                          ].map(([label, value, color]) => (
                            <div key={label} style={{ background: "rgba(255,255,255,0.035)", borderRadius: "12px", padding: "13px 12px", textAlign: "center" }}>
                              <div style={{ color, fontSize: typeof value === "number" ? "24px" : "21px", lineHeight: 1 }}>{value}</div>
                              <div style={{ marginTop: "8px", color: "#596078", fontSize: "13px", letterSpacing: "0.06em" }}>{label}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: "22px", display: "grid", gap: "14px" }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#aeb5d4", fontSize: "16px" }}>
                              <span>Connect rate</span>
                              <span style={{ color: "#596078" }}>{agent.connectRate}%</span>
                            </div>
                            <div style={{ marginTop: "10px", height: "9px", borderRadius: "999px", background: "rgba(122, 73, 255, 0.18)" }}>
                              <div style={{ height: "100%", width: `${agent.connectRate}%`, borderRadius: "999px", background: "linear-gradient(90deg, #8b3ff4, #bc5cff)" }} />
                            </div>
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#aeb5d4", fontSize: "16px" }}>
                              <span>Conversion</span>
                              <span style={{ color: "#596078" }}>{agent.conversionRate}%</span>
                            </div>
                            <div style={{ marginTop: "10px", height: "9px", borderRadius: "999px", background: "rgba(122, 73, 255, 0.18)" }}>
                              <div style={{ height: "100%", width: `${agent.conversionRate}%`, borderRadius: "999px", background: "#27d8ff" }} />
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: "18px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "7px 14px",
                              borderRadius: "999px",
                              color: agent.badge === "break" ? "#ffd02d" : agent.badge === "offline" ? "#ff7685" : "#35e5a7",
                              border: `1px solid ${agent.badge === "break" ? "rgba(255, 208, 45, 0.48)" : agent.badge === "offline" ? "rgba(255, 118, 133, 0.42)" : "rgba(53, 229, 167, 0.42)"}`,
                              background: agent.badge === "break" ? "rgba(255, 208, 45, 0.1)" : agent.badge === "offline" ? "rgba(255, 118, 133, 0.1)" : "rgba(53, 229, 167, 0.12)",
                            }}
                          >
                            {agent.badge}
                          </span>
                          <button type="button" onClick={() => openEditAgent(agent)} style={{ ...ghostButton, padding: "7px 14px", borderRadius: "999px", fontSize: "14px" }}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setForceLogoutTarget({ type: "single", agent })}
                            disabled={agent.status === "offline"}
                            style={{
                              ...ghostButton,
                              padding: "7px 14px",
                              borderRadius: "999px",
                              fontSize: "14px",
                              color: "#ffb45c",
                              borderColor: "rgba(255, 180, 92, 0.42)",
                              background: "rgba(255, 180, 92, 0.08)",
                              opacity: agent.status === "offline" ? 0.5 : 1,
                            }}
                          >
                            Force Logout
                          </button>
                          <button type="button" onClick={() => setDeletingAgent(agent)} style={{ ...ghostButton, padding: "7px 14px", borderRadius: "999px", fontSize: "14px", color: "#ff7685", borderColor: "rgba(255, 118, 133, 0.42)" }}>
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div style={{ ...panel, padding: "32px", gridColumn: "1 / -1", color: "#aeb5d4" }}>
                      No agents found.
                    </div>
                  )}
                </section>
              ) : (
                <section style={{ ...panel, marginTop: "34px", padding: "26px", overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: "1500px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#6d728d", letterSpacing: "0.06em" }}>
                        {["AGENT", "EMPLOYEE ID", "STATUS", "LOGIN", "TOTAL LOGIN TIME", "STAFF TIME", "BREAKS", "BREAK TIME", "BREAK REASON", "CALLS", "CONNECTED", "POSITIVE", "CONNECT RATE", "CONVERSION", "ACTIONS"].map((heading) => (
                          <th key={heading} style={{ padding: "14px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAgentCards.map((agent) => (
                        <tr key={agent.dbId} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                          <td style={{ padding: "15px 14px" }}>{agent.name}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.id}</td>
                          <td style={{ padding: "15px 14px" }}>
                            <span style={{ 
                              padding: "4px 12px", 
                              borderRadius: "999px", 
                              fontSize: "14px",
                              background: agent.status === "online" ? "rgba(38, 230, 173, 0.1)" : 
                                         agent.status === "break" ? "rgba(255, 165, 0, 0.1)" : 
                                         "rgba(255, 118, 133, 0.1)",
                              color: agent.status === "online" ? "#35e5a7" : 
                                     agent.status === "break" ? "#ffa500" : "#ff7685",
                              border: `1px solid ${agent.status === "online" ? "rgba(38, 230, 173, 0.2)" : 
                                                 agent.status === "break" ? "rgba(255, 165, 0, 0.2)" : 
                                                 "rgba(255, 118, 133, 0.2)"}` 
                            }}>
                              {displayAgentStatus(agent.status)}
                            </span>
                          </td>
                          <td style={{ padding: "15px 14px" }}>{formatDateTime(agent.loginTime)}</td>
                          <td style={{ padding: "15px 14px" }}>{formatDuration(agent.totalLoginDuration)}</td>
                          <td style={{ padding: "15px 14px" }}>{formatDuration(agent.staffTimeDuration)}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.breakCount}</td>
                          <td style={{ padding: "15px 14px" }}>{formatDuration(agent.totalBreakDuration)}</td>
                          <td title={agent.breakRemark || agent.breakReason} style={{ padding: "15px 14px", color: agent.status === "break" ? "#ffcf8a" : "#6d728d", maxWidth: "180px" }}>
                            {agent.status === "break" && agent.breakReason ? (
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {agent.breakReason}
                                {agent.breakRemark ? ` | ${agent.breakRemark}` : ""}
                              </div>
                            ) : "NA"}
                          </td>
                          <td style={{ padding: "15px 14px" }}>{agent.calls}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.connected}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.positive}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.connectRate}%</td>
                          <td style={{ padding: "15px 14px" }}>{agent.conversionRate}%</td>
                          <td style={{ padding: "15px 14px" }}>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button type="button" onClick={() => openEditAgent(agent)} style={{ ...ghostButton, padding: "8px 12px", borderRadius: "10px", fontSize: "14px" }}>
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setForceLogoutTarget({ type: "single", agent })}
                                disabled={agent.status === "offline"}
                                style={{
                                  ...ghostButton,
                                  padding: "8px 12px",
                                  borderRadius: "10px",
                                  fontSize: "14px",
                                  color: "#ffb45c",
                                  borderColor: "rgba(255, 180, 92, 0.42)",
                                  background: "rgba(255, 180, 92, 0.08)",
                                  opacity: agent.status === "offline" ? 0.5 : 1,
                                }}
                              >
                                Force Logout
                              </button>
                              <button type="button" onClick={() => setDeletingAgent(agent)} style={{ ...ghostButton, padding: "8px 12px", borderRadius: "10px", fontSize: "14px", color: "#ff7685", borderColor: "rgba(255, 118, 133, 0.42)" }}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          ) : activeView === "reports" ? (
            <>
              <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 700 }}>Reports</h1>
                  <div style={{ marginTop: "12px", color: "#9da6c3", fontSize: "18px" }}>
                    Generate, preview & download structured reports
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {/* <button type="button" onClick={() => downloadReport("csv")} style={ghostButton}>
                    Download CSV
                  </button> */}
                  {/* <button type="button" onClick={() => downloadReport("excel")} style={ghostButton}>
                    Download Excel
                  </button> */}
                  {/* <button type="button" onClick={printReport} style={ghostButton}>
                    Print / PDF
                  </button> */}
                </div>
              </div>

              {/* <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "28px 32px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "22px" }}>Grouped Reports</h2>
                  <span style={{ padding: "8px 18px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                    Today | Yesterday | Older
                  </span>
                </div>
                <div style={{ marginTop: "22px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                <div style={{ marginTop: "22px", display: "grid", gap: "20px" }}>
                  {groupedReportRows.map(([label, rows]) => (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#9da6c3", marginBottom: "10px" }}>
                        <strong>{label}</strong>
                        <span>{rows.length} newest first</span>
                      </div>
                      <div className="admin-scroll" style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(122, 73, 255, 0.18)" }}>
                        <table className="admin-polished-table" style={{ width: "100%", minWidth: "780px", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                              {["REF ID", "AGENT", "STATUS", "DISPOSITION", "DATE"].map((heading) => (
                                <th key={heading} style={{ padding: "11px 10px", borderBottom: "1px solid rgba(122, 73, 255, 0.2)" }}>{heading}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 5).map((item) => {
                              const tone = statusTone(item.call_status);

                              return (
                                <tr key={`${label}-${item.id}`} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.12)" }}>
                                <td style={{ padding: "14px 12px", color: "#c681ff", fontWeight: 700 }}>{item.reference_id}</td>
                                  <td style={{ padding: "12px 10px" }}>{item.employee_name}</td>
                                  <td style={{ padding: "12px 10px" }}>
                                    <span style={{ display: "inline-flex", padding: "5px 11px", borderRadius: "999px", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}>
                                      {item.call_status}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 10px" }}>{item.disposition}</td>
                                  <td style={{ padding: "12px 10px", color: "#7d849f" }}>{item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "-"}</td>
                                </tr>
                              );
                            })}
                            {!rows.length ? (
                              <tr>
                                <td colSpan="5" style={{ padding: "20px 12px" }}>
                                  <div className="admin-empty-state">No records in this group.</div>
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section> */}

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "28px", padding: "32px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "24px" }}>All Responses Reports</h2>
                  <span style={{ color: "#7d849f", fontSize: "14px" }}>Choose scope, then generate preview</span>
                </div>
                <div style={{ marginTop: "26px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />

                <div className="admin-filter-grid" style={{ marginTop: "26px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "18px", alignItems: "end" }}>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    DATE FROM
                    <input
                      type="date"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={reportDateFrom}
                      onChange={(event) => {
                        setReportDateFrom(event.target.value);
                        setReportGenerated(false);
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    DATE TO
                    <input
                      type="date"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={reportDateTo}
                      onChange={(event) => {
                        setReportDateTo(event.target.value);
                        setReportGenerated(false);
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    AGENT
                    <select
                      className="admin-select"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={reportAgent}
                      onChange={(event) => {
                        setReportAgent(event.target.value);
                        setReportGenerated(false);
                      }}
                    >
                      <option value="all">All agents</option>
                      {agents.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={loadReportRows}
                    disabled={isReportLoading}
                    style={{ ...ghostButton, minWidth: "190px", minHeight: "60px", fontSize: "19px", background: "rgba(168, 85, 247, 0.18)", borderColor: "rgba(168, 85, 247, 0.5)" }}
                    className="admin-action-button"
                  >
                    {isReportLoading ? "Generating..." : "Generate"}
                  </button>
                </div>
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "24px", padding: "32px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "24px" }}>Ranking & Conversion % Report</h2>
                </div>
                <div style={{ marginTop: "24px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                <div className="admin-filter-grid" style={{ marginTop: "26px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "18px", alignItems: "end" }}>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    START DATE
                    <input
                      type="date"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={rankingReportDateFrom}
                      onChange={(event) => {
                        setRankingReportDateFrom(event.target.value);
                        setRankingReportGenerated(false);
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    END DATE
                    <input
                      type="date"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={rankingReportDateTo}
                      onChange={(event) => {
                        setRankingReportDateTo(event.target.value);
                        setRankingReportGenerated(false);
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    AGENT
                    <select
                      className="admin-select"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={rankingReportAgent}
                      onChange={(event) => {
                        setRankingReportAgent(event.target.value);
                        setRankingReportGenerated(false);
                      }}
                    >
                      <option value="all">All Agents</option>
                      {rankingAgentOptions.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={loadRankingReportRows}
                    disabled={isRankingReportLoading}
                    style={{ ...ghostButton, minWidth: "210px", minHeight: "60px", fontSize: "19px", background: "rgba(168, 85, 247, 0.18)", borderColor: "rgba(168, 85, 247, 0.5)" }}
                    className="admin-action-button"
                  >
                    {isRankingReportLoading ? "Generating..." : "Generate Report"}
                  </button>
                </div>
              </section>

              {rankingReportGenerated ? (
                <section className="admin-soft-panel" style={{ ...panel, marginTop: "24px", padding: "30px 34px", maxWidth: "930px" }}>
                  <div className="admin-section-heading">
                    <div>
                      <h2 style={{ margin: 0, fontSize: "24px" }}>Ranking & Conversion % Report</h2>
                      <div style={{ marginTop: "8px", color: "#9da6c3" }}>
                        {rankingReportDateLabel()} | {rankingReportRows.length} agents
                      </div>
                    </div>
                    <button type="button" onClick={downloadRankingReport} className="admin-action-button" style={ghostButton}>
                      Download CSV
                    </button>
                  </div>

                  <div className="admin-scroll" style={{ marginTop: "24px", overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(122, 73, 255, 0.18)" }}>
                    <table className="admin-polished-table" style={{ width: "100%", minWidth: "1120px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                          {["RANK", "AGENT NAME", "EMPLOYEE ID", "DATE", "SCORE", "POSITIVE", "CONNECTED", "TOTAL CALLS", "CONVERSION %"].map((heading) => (
                            <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rankingReportRows.map((row) => (
                          <tr key={row.agent_id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                            <td style={{ padding: "14px 12px", color: "#d9b7ff", fontWeight: 700 }}>{row.rank}</td>
                            <td style={{ padding: "14px 12px" }}>{row.agent_name}</td>
                            <td style={{ padding: "14px 12px" }}>{row.employee_id}</td>
                            <td style={{ padding: "14px 12px" }}>{rankingReportDateLabel()}</td>
                            <td style={{ padding: "14px 12px", color: "#ffd166", fontWeight: 700 }}>{row.ranking_score}</td>
                            <td style={{ padding: "14px 12px" }}>{row.positive_calls}</td>
                            <td style={{ padding: "14px 12px" }}>{row.connected_calls}</td>
                            <td style={{ padding: "14px 12px" }}>{row.total_calls}</td>
                            <td style={{ padding: "14px 12px" }}>{row.conversion_rate}%</td>
                          </tr>
                        ))}
                        {!rankingReportRows.length ? (
                          <tr>
                            <td colSpan="9" style={{ padding: "22px 12px" }}>
                              <div className="admin-empty-state">No ranking rows match these filters.</div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "24px", padding: "32px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "24px" }}>Session & Break Report</h2>
                  <span style={{ color: "#7d849f", fontSize: "14px" }}>Server timestamp based session export</span>
                </div>
                <div style={{ marginTop: "24px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                <div className="admin-filter-grid" style={{ marginTop: "26px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "18px", alignItems: "end" }}>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    DATE FROM
                    <input
                      type="date"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={timeReportDateFrom}
                      onChange={(event) => {
                        setTimeReportDateFrom(event.target.value);
                        setTimeReportGenerated(false);
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    DATE TO
                    <input
                      type="date"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={timeReportDateTo}
                      onChange={(event) => {
                        setTimeReportDateTo(event.target.value);
                        setTimeReportGenerated(false);
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    AGENT
                    <select
                      className="admin-select"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={timeReportAgent}
                      onChange={(event) => {
                        setTimeReportAgent(event.target.value);
                        setTimeReportGenerated(false);
                      }}
                    >
                      <option value="all">All agents</option>
                      {agents.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={loadTimeReportRows}
                    disabled={isTimeReportLoading}
                    style={{ ...ghostButton, minWidth: "190px", minHeight: "60px", fontSize: "19px", background: "rgba(39, 216, 255, 0.14)", borderColor: "rgba(39, 216, 255, 0.42)" }}
                    className="admin-action-button"
                  >
                    {isTimeReportLoading ? "Generating..." : "Generate"}
                  </button>
                </div>
              </section>

              {timeReportGenerated ? (
                <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "30px 34px", maxWidth: "930px" }}>
                  <div className="admin-section-heading">
                    <div>
                      <h2 style={{ margin: 0, fontSize: "24px" }}>
                        Session & Break Report Preview
                      </h2>
                      <div style={{ marginTop: "8px", color: "#9da6c3" }}>
                        {timeReportDateFrom} to {timeReportDateTo} | {timeReportRecords.length} break rows
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <button type="button" onClick={downloadTimeReport} className="admin-action-button" style={ghostButton}>
                        Download CSV
                      </button>
                      <button type="button" onClick={printTimeReport} className="admin-action-button" style={ghostButton}>
                        Print / PDF
                      </button>
                    </div>
                  </div>

                  <section className="admin-kpi-grid" style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                    {[
                      ["TOTAL LOGIN TIME", formatDurationHuman(timeReportSummary.totalLoginDuration), "#9bdcff"],
                      ["TOTAL STAFF TIME", formatDurationHuman(timeReportSummary.staffTimeDuration), "#35e5a7"],
                      ["BREAK TIME", formatDurationHuman(timeReportSummary.totalBreakDuration), "#ffb45c"],
                      ["BREAK COUNT", timeReportSummary.totalBreakCount, "#ff717e"],
                    ].map(([title, value, accent]) => (
                      <article key={title} style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "12px", padding: "18px" }}>
                        <div style={{ color: "#8f98b7", fontSize: "14px" }}>{title}</div>
                        <div style={{ marginTop: "10px", color: accent, fontSize: typeof value === "number" ? "30px" : "22px" }}>{value}</div>
                      </article>
                    ))}
                  </section>

                  <div className="admin-scroll" style={{ marginTop: "24px", overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(122, 73, 255, 0.18)" }}>
                    <table className="admin-polished-table" style={{ width: "100%", minWidth: "1180px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                          {["AGENT NAME", "EMPLOYEE ID", "LOGIN DATE", "LOGIN TIME", "LOGOUT TIME", "BREAK #", "BREAK REASON", "BREAK START", "BREAK END", "BREAK DURATION", "TOTAL LOGIN", "TOTAL STAFF", "TOTAL BREAK TIME"].map((heading) => (
                            <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {timeReportRecords.slice(0, 10).map((item) => (
                          <tr key={`${item.session_id}-${item.break_id || "no-break"}`} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                            <td style={{ padding: "14px 12px" }}>{item.agent_name}</td>
                            <td style={{ padding: "14px 12px" }}>{item.employee_id}</td>
                            <td style={{ padding: "14px 12px" }}>{formatReportDateOnly(item.login_time)}</td>
                            <td style={{ padding: "14px 12px" }}>{formatTimeOnly(item.login_time)}</td>
                            <td style={{ padding: "14px 12px" }}>{formatTimeOnly(item.logout_time)}</td>
                            <td style={{ padding: "14px 12px" }}>{item.break_number || ""}</td>
                            <td style={{ padding: "14px 12px", color: "#ffcf8a", minWidth: "180px" }}>{item.break_reason || ""}</td>
                            <td style={{ padding: "14px 12px" }}>{formatTimeOnly(item.break_start_time)}</td>
                            <td style={{ padding: "14px 12px" }}>{formatTimeOnly(item.break_end_time)}</td>
                            <td style={{ padding: "14px 12px", color: "#ffb45c" }}>{formatDurationHuman(item.break_duration)}</td>
                            <td style={{ padding: "14px 12px", color: "#9bdcff" }}>{formatDurationHuman(item.total_login_duration)}</td>
                            <td style={{ padding: "14px 12px", color: "#35e5a7" }}>{formatDurationHuman(item.staff_time_duration)}</td>
                            <td style={{ padding: "14px 12px", color: "#ffb45c" }}>{formatDurationHuman(item.total_break_duration)}</td>
                          </tr>
                        ))}
                        {!timeReportRecords.length ? (
                          <tr>
                            <td colSpan="13" style={{ padding: "22px 12px" }}>
                              <div className="admin-empty-state">No session or break rows match these filters.</div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "24px", padding: "32px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "24px" }}>Downtime Report</h2>
                  <span style={{ color: "#7d849f", fontSize: "14px" }}>Approved system downtime records</span>
                </div>
                <div style={{ marginTop: "24px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                <div className="admin-filter-grid" style={{ marginTop: "26px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "18px", alignItems: "end" }}>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    DATE FROM
                    <input
                      type="date"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={downtimeReportDateFrom}
                      onChange={(event) => {
                        setDowntimeReportDateFrom(event.target.value);
                        setDowntimeReportGenerated(false);
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    DATE TO
                    <input
                      type="date"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={downtimeReportDateTo}
                      onChange={(event) => {
                        setDowntimeReportDateTo(event.target.value);
                        setDowntimeReportGenerated(false);
                      }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "12px", color: "#9da6c3", fontSize: "17px", letterSpacing: "0.04em" }}>
                    AGENT
                    <select
                      className="admin-select"
                      style={{ ...input, fontSize: "22px", padding: "16px 18px" }}
                      value={downtimeReportAgent}
                      onChange={(event) => {
                        setDowntimeReportAgent(event.target.value);
                        setDowntimeReportGenerated(false);
                      }}
                    >
                      <option value="all">All agents</option>
                      {agents.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={loadDowntimeReportRows}
                    disabled={isDowntimeReportLoading}
                    style={{ ...ghostButton, minWidth: "190px", minHeight: "60px", fontSize: "19px", background: "rgba(39, 216, 255, 0.14)", borderColor: "rgba(39, 216, 255, 0.42)" }}
                    className="admin-action-button"
                  >
                    {isDowntimeReportLoading ? "Generating..." : "Generate"}
                  </button>
                </div>
              </section>

              {downtimeReportGenerated ? (
                <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "30px 34px", maxWidth: "930px" }}>
                  <div className="admin-section-heading">
                    <div>
                      <h2 style={{ margin: 0, fontSize: "24px" }}>Downtime Report Preview</h2>
                      <div style={{ marginTop: "8px", color: "#9da6c3" }}>
                        {downtimeReportDateFrom} to {downtimeReportDateTo} | {downtimeReportRecords.length} records
                      </div>
                    </div>
                    <button type="button" onClick={downloadDowntimeReport} className="admin-action-button" style={ghostButton}>
                      Download CSV
                    </button>
                  </div>

                  <div className="admin-scroll" style={{ marginTop: "24px", overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(122, 73, 255, 0.18)" }}>
                    <table className="admin-polished-table" style={{ width: "100%", minWidth: "1180px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                          {["AGENT NAME", "EMPLOYEE ID", "DATE", "ISSUE TYPE", "COMMENT", "APPROVED BY", "START TIME", "END TIME", "DURATION"].map((heading) => (
                            <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {downtimeReportRecords.slice(0, 10).map((item) => (
                          <tr key={item.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                            <td style={{ padding: "14px 12px" }}>{item.agentName}</td>
                            <td style={{ padding: "14px 12px" }}>{item.employeeId}</td>
                            <td style={{ padding: "14px 12px" }}>{formatReportDateOnly(item.requestedAt)}</td>
                            <td style={{ padding: "14px 12px", color: "#9bdcff" }}>{item.issueType}</td>
                            <td style={{ padding: "14px 12px", maxWidth: "260px" }}>{item.comment}</td>
                            <td style={{ padding: "14px 12px" }}>{item.approvedByName || "NA"}</td>
                            <td style={{ padding: "14px 12px" }}>{formatDateTime(item.approvedAt)}</td>
                            <td style={{ padding: "14px 12px" }}>{formatDateTime(item.resolvedAt)}</td>
                            <td style={{ padding: "14px 12px", color: "#35e5a7" }}>{formatDurationHuman(item.durationSeconds || item.runningDurationSeconds)}</td>
                          </tr>
                        ))}
                        {!downtimeReportRecords.length ? (
                          <tr>
                            <td colSpan="9" style={{ padding: "22px 12px" }}>
                              <div className="admin-empty-state">No downtime rows match these filters.</div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {reportGenerated ? (
                <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "30px 34px", maxWidth: "930px" }}>
                  <div className="admin-section-heading">
                    <div>
                      <h2 style={{ margin: 0, fontSize: "24px" }}>Report Preview</h2>
                      <div style={{ marginTop: "8px", color: "#9da6c3" }}>
                        {reportDateFrom} to {reportDateTo} | {reportRows.length} backend records
                      </div>
                    </div>
                    <button type="button" onClick={() => downloadReport("csv")} className="admin-action-button" style={ghostButton}>
                      Download CSV
                    </button>
                  </div>

                  <section className="admin-kpi-grid" style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px" }}>
                    {reportKpis.map(([title, value, accent]) => (
                      <article key={title} style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "12px", padding: "18px" }}>
                        <div style={{ color: "#8f98b7", fontSize: "14px" }}>{title}</div>
                        <div style={{ marginTop: "10px", color: accent, fontSize: typeof value === "number" ? "30px" : "22px" }}>{value}</div>
                      </article>
                    ))}
                  </section>

                  <section style={{ marginTop: "26px" }}>
                    {reportType === "daily" ? (
                      <div className="admin-two-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "18px" }}>
                        <article style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "14px", padding: "22px" }}>
                          <h3 style={{ margin: 0 }}>Daily call volume trend</h3>
                          <svg viewBox="0 0 520 230" style={{ width: "100%", marginTop: "18px" }}>
                            {[0, 1, 2, 3, 4].map((line) => (
                              <line key={line} x1="35" x2="500" y1={28 + line * 40} y2={28 + line * 40} stroke="rgba(132, 80, 255, 0.18)" />
                            ))}
                            <path d="M40 175 C90 145 95 86 145 76 S220 138 260 118 S330 62 380 84 S450 148 495 112" fill="rgba(168,85,247,0.12)" stroke="#a855f7" strokeWidth="4" />
                            <path d="M40 190 C90 162 100 128 145 118 S220 162 260 150 S330 98 380 112 S450 172 495 145" fill="none" stroke="#35e5a7" strokeWidth="4" strokeDasharray="8 8" />
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, index) => (
                              <text key={label} x={40 + index * 88} y="220" fill="#596078" fontSize="13">{label}</text>
                            ))}
                          </svg>
                        </article>
                        <article style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "14px", padding: "22px" }}>
                          <h3 style={{ margin: 0 }}>Stacked status bar</h3>
                          <div style={{ marginTop: "28px", display: "grid", gap: "18px" }}>
                            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => (
                              <div key={day} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "12px", alignItems: "center" }}>
                                <span style={{ color: "#9da6c3" }}>{day}</span>
                                <div style={{ height: "24px", borderRadius: "8px", overflow: "hidden", display: "flex", background: "#3e485b" }}>
                                  <div style={{ width: `${55 + index * 7}%`, background: "#7c34f2" }} />
                                  <div style={{ flex: 1, background: "#3e485b" }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </article>
                      </div>
                    ) : reportType === "agent" ? (
                      <article style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "14px", padding: "22px" }}>
                        <h3 style={{ margin: 0 }}>Agent performance comparison</h3>
                        <div style={{ marginTop: "22px", display: "grid", gap: "16px" }}>
                          {reportAgentStats.slice(0, 8).map((agent) => (
                            <div key={agent.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr 72px 72px", gap: "14px", alignItems: "center" }}>
                              <strong>{agent.name}</strong>
                              <div style={{ height: "26px", borderRadius: "8px", background: "rgba(122,73,255,0.16)" }}>
                                <div style={{ width: `${Math.max((agent.total / maxReportAgentTotal) * 100, 5)}%`, height: "100%", borderRadius: "8px", background: "linear-gradient(90deg,#7c34f2,#27d8ff)" }} />
                              </div>
                              <span>{agent.connectRate}%</span>
                              <span>{agent.conversionRate}%</span>
                            </div>
                          ))}
                        </div>
                      </article>
                    ) : reportType === "disposition" ? (
                      <div className="admin-two-grid" style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "18px" }}>
                        <article style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "14px", padding: "22px", display: "grid", placeItems: "center" }}>
                          <h3 style={{ justifySelf: "start", margin: 0 }}>Disposition doughnut</h3>
                          <div style={{ marginTop: "26px", width: "260px", height: "260px", borderRadius: "999px", background: "conic-gradient(#35e5a7 0 24%, #a855f7 24% 58%, #ff717e 58% 78%, #27d8ff 78% 100%)", display: "grid", placeItems: "center" }}>
                            <div style={{ width: "140px", height: "140px", borderRadius: "999px", background: "#121027", display: "grid", placeItems: "center", color: "#9da6c3" }}>
                              {reportRows.length}
                            </div>
                          </div>
                        </article>
                        <article style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "14px", padding: "22px" }}>
                          <h3 style={{ margin: 0 }}>Percentage breakdown</h3>
                          <div style={{ marginTop: "22px", display: "grid", gap: "16px" }}>
                            {reportDispositionStats.slice(0, 7).map((item) => (
                              <div key={item.label} style={{ display: "grid", gridTemplateColumns: "160px 1fr 62px", gap: "14px", alignItems: "center" }}>
                                <span style={{ color: "#9da6c3" }}>{item.label}</span>
                                <div style={{ height: "24px", borderRadius: "8px", background: "rgba(122,73,255,0.16)" }}>
                                  <div style={{ width: `${Math.max((item.value / maxReportDisposition) * 100, 5)}%`, height: "100%", borderRadius: "8px", background: "#a855f7" }} />
                                </div>
                                <span>{reportRows.length ? Math.round((item.value / reportRows.length) * 100) : 0}%</span>
                              </div>
                            ))}
                          </div>
                        </article>
                      </div>
                    ) : (
                      <div className="admin-two-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "18px" }}>
                        <article style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "14px", padding: "22px" }}>
                          <h3 style={{ margin: 0 }}>Positive trend</h3>
                          <svg viewBox="0 0 500 220" style={{ width: "100%", marginTop: "18px" }}>
                            {[0, 1, 2, 3, 4].map((line) => (
                              <line key={line} x1="35" x2="470" y1={28 + line * 38} y2={28 + line * 38} stroke="rgba(132,80,255,0.18)" />
                            ))}
                            <path d="M45 170 C110 145 135 102 185 118 S265 80 310 95 S385 70 460 58" fill="rgba(53,229,167,0.12)" stroke="#35e5a7" strokeWidth="4" />
                            {[45, 185, 310, 460].map((x, index) => (
                              <circle key={x} cx={x} cy={[170, 118, 95, 58][index]} r="6" fill="#35e5a7" />
                            ))}
                          </svg>
                        </article>
                        <article style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(122, 73, 255, 0.14)", borderRadius: "14px", padding: "22px" }}>
                          <h3 style={{ margin: 0 }}>Agent-wise conversion rate</h3>
                          <div style={{ marginTop: "22px", display: "grid", gap: "16px" }}>
                            {reportAgentStats.slice(0, 7).map((agent) => (
                              <div key={agent.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr 54px", gap: "14px", alignItems: "center" }}>
                                <span>{agent.name}</span>
                                <div style={{ height: "22px", borderRadius: "8px", background: "rgba(122,73,255,0.16)" }}>
                                  <div style={{ width: `${Math.max(agent.conversionRate, 4)}%`, height: "100%", borderRadius: "8px", background: "#35e5a7" }} />
                                </div>
                                <span>{agent.conversionRate}%</span>
                              </div>
                            ))}
                          </div>
                        </article>
                      </div>
                    )}
                  </section>

                  <div className="admin-scroll" style={{ marginTop: "24px", overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(122, 73, 255, 0.18)" }}>
                    <table className="admin-polished-table" style={{ width: "100%", minWidth: "1260px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                          {["CUSTOMER NAME", "AGENT", "EMPLOYEE ID", "ZOHO ID", "DIALER", "CALL STATUS", "CONNECTED STATUS", "DISPOSITION", "SUB-DISP", "LANGUAGE", "DATE / TIME"].map((heading) => (
                            <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportRows.slice(0, 8).map((item) => {
                          const tone = statusTone(item.call_status);

                          return (
                            <tr key={item.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                              <td style={{ padding: "16px 12px", color: "#c681ff", fontWeight: 700 }}>{item.reference_id}</td>
                              <td style={{ padding: "14px 12px" }}>{item.employee_name}</td>
                              <td style={{ padding: "14px 12px" }}>{item.employee_id}</td>
                              <td style={{ padding: "14px 12px" }}>{item.zoho_id || "NA"}</td>
                              <td style={{ padding: "14px 12px" }}>{item.dialer_id || "NA"}</td>
                              <td style={{ padding: "14px 12px" }}>
                                <span style={{ display: "inline-flex", padding: "6px 12px", borderRadius: "999px", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}>
                                  {item.call_status}
                                </span>
                              </td>
                              <td style={{ padding: "14px 12px" }}>{item.call_status === "Connected" ? "Connected" : "Not Connected"}</td>
                              <td style={{ padding: "14px 12px" }}>{item.disposition}</td>
                              <td style={{ padding: "14px 12px" }}>{item.sub_disposition || "NA"}</td>
                              <td style={{ padding: "14px 12px" }}>{item.language === "Other" ? item.language_other || "Other" : item.language}</td>
                              <td style={{ padding: "14px 12px" }}>
                                <div style={{ color: "#d7dce9" }}>{formatDateOnly(item.created_at)}</div>
                                <div style={{ marginTop: "4px", color: "#7d849f", fontSize: "13px" }}>{formatTimeOnly(item.created_at)}</div>
                              </td>
                            </tr>
                          );
                        })}
                        {!reportRows.length ? (
                          <tr>
                            <td colSpan="11" style={{ padding: "22px 12px" }}>
                              <div className="admin-empty-state">No report rows match these filters.</div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>

          ) : (
            <>
          <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Admin Dashboard</h1>
              <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                {formatDate(new Date())} | All agents
              </div>
            </div>
            <div className="admin-toolbar-actions" style={{ display: "flex", gap: "12px" }}>
            
              <button type="button" onClick={() => downloadResponsesExport(token)} style={ghostButton}>
                Export CSV
              </button>
            </div>
          </div>

          <section className="admin-kpi-grid" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "16px" }}>
            {[
              ["TOTAL CALLS TODAY", analytics.totalCalls, "", "#a855f7"],
              ["CONNECTED", analytics.connectedCalls, `${analytics.connectRate}% connect rate`, "#27d8ff"],
              ["POSITIVE / CONVERTED", analytics.positiveCalls, `${analytics.conversionRate}% conversion`, "#35e5a7"],
              ["NOT CONNECTED", analytics.notConnectedCalls, "Today only", "#ff717e"],
              ["ACTIVE AGENTS", analytics.activeAgents, "Backend live status", "#ffd02d"],
              ["AGENTS ON BREAK", analytics.agentsOnBreak, "Backend live status", "#ffa500"],
            ].map(([title, value, note, accent]) => (
              <article
                key={title}
                style={{
                  ...panel,
                  padding: "20px 24px",
                  borderTop: `3px solid ${accent}`,
                  minHeight: "150px",
                }}
              >
                <div style={{ color: "#8f98b7", fontSize: "15px", lineHeight: 1.1 }}>{title}</div>
                <div style={{ marginTop: "14px", color: accent, fontSize: "34px", lineHeight: 1 }}>{value}</div>
                <div style={{ marginTop: "14px", color: "#616782", fontSize: "14px" }}>{note}</div>
              </article>
            ))}
          </section>

          <section style={{ marginTop: "28px", display: "grid" }}>
            <article style={{ ...panel, padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "19px" }}>Call status breakdown</h2>
                <span style={{ padding: "6px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                  Today
                </span>
              </div>
              <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
              <div className="overview-status-bars">
                {callStatusBars.map((bar) => {
                  const height = Math.max((bar.value / maxStatusCalls) * 100, 8);
                  return (
                    <div key={bar.label} style={{ minWidth: 0 }}>
                      <div style={{ height: "220px", display: "flex", alignItems: "end", justifyContent: "center", padding: "0 12px" }}>
                        <div
                          title={`${bar.label}: ${bar.value}`}
                          style={{
                            width: "100%",
                            maxWidth: "126px",
                            height: `${height}%`,
                            minHeight: "28px",
                            borderRadius: "12px 12px 8px 8px",
                            background: bar.color,
                            boxShadow: `0 18px 36px ${bar.glow}`,
                          }}
                        />
                      </div>
                      <div style={{ marginTop: "14px", textAlign: "center", minHeight: "58px" }}>
                        <div style={{ color: "#f4f0ff", fontSize: "15px", fontWeight: 700, lineHeight: 1.25 }}>{bar.label}</div>
                        <div style={{ marginTop: "6px", color: "#aeb5d4", fontSize: "20px", fontWeight: 800 }}>{bar.value}</div>
                        <div style={{ marginTop: "4px", color: "#6d728d", fontSize: "12px", lineHeight: 1.25 }}>{bar.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>

          <section className="admin-two-grid" style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "18px" }}>
            <article className="overview-disposition-card" style={{ ...panel, padding: "28px", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "19px" }}>Disposition distribution</h2>
                <span style={{ padding: "6px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                  Today
                </span>
              </div>
              <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
              <div className="overview-disposition-body">
                <div
                  style={{
                    width: "min(100%, 280px)",
                    aspectRatio: "1",
                    borderRadius: "999px",
                    background: dispositionGradient,
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 24px 54px rgba(0,0,0,0.28)",
                  }}
                >
                  <div
                    style={{
                      width: "44%",
                      aspectRatio: "1",
                      borderRadius: "999px",
                      background: "#121027",
                      display: "grid",
                      placeItems: "center",
                      color: "#f4f0ff",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ textAlign: "center", lineHeight: 1.2 }}>
                      <div style={{ fontSize: "28px", fontWeight: 800 }}>{analytics.totalCalls}</div>
                      <div style={{ color: "#8f98b7", fontSize: "12px", fontWeight: 700 }}>TOTAL</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "12px", width: "100%" }}>
                  {dispositionSegments.length ? (
                    dispositionSegments.map((item) => (
                      <div key={item.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "14px", alignItems: "center" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "#f4f0ff", fontWeight: 700 }}>
                            <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: item.color, flex: "0 0 auto" }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                          </div>
                          <div style={{ marginTop: "8px", height: "8px", borderRadius: "999px", background: "rgba(132, 80, 255, 0.16)", overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(item.percent, 4)}%`, height: "100%", borderRadius: "999px", background: item.color }} />
                          </div>
                        </div>
                        <div style={{ color: "#aeb5d4", fontWeight: 800, textAlign: "right" }}>
                          {item.value}
                          <div style={{ color: "#6d728d", fontSize: "12px", fontWeight: 700 }}>{item.percent}%</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#8f98b7" }}>No disposition data yet.</div>
                  )}
                </div>
              </div>
            </article>

            <article style={{ ...panel, padding: "28px" }}>
              <h2 style={{ margin: 0, fontSize: "19px" }}>Agent performance</h2>
              <div style={{ marginTop: "24px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
              <div style={{ marginTop: "24px", display: "grid", gap: "18px" }}>
                {agentPerformance.length ? (
                  agentPerformance.map((agent) => (
                    <div key={agent.name} style={{ display: "grid", gridTemplateColumns: "110px 1fr 34px", gap: "12px", alignItems: "center" }}>
                      <div style={{ fontWeight: 700 }}>{agent.name}</div>
                      <div style={{ height: "8px", borderRadius: "999px", background: "rgba(132, 80, 255, 0.16)" }}>
                        <div style={{ width: `${(agent.total / maxAgentCalls) * 100}%`, height: "100%", borderRadius: "999px", background: "#a855f7" }} />
                      </div>
                      <div style={{ color: "#aeb5d4", textAlign: "right" }}>{agent.total}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#8f98b7" }}>No agent data yet.</div>
                )}
              </div>
            </article>
          </section>

          <section className="admin-create-grid" style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "18px" }}>
            <article style={{ ...panel, padding: "28px", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "19px" }}>Recent responses</h2>
                <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                  Latest 6
                </span>
              </div>
              <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
              <div style={{ marginTop: "22px", display: "grid", gap: "12px" }}>
                <input style={input} placeholder="Search by Ref ID or agent..." value={search} onChange={(event) => setSearch(event.target.value)} />
                <select className="admin-select" style={input} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All status</option>
                  <option value="Connected">Connected</option>
                  <option value="Not Connected">Not Connected</option>
                </select>
                <select className="admin-select" style={input} value={dispositionFilter} onChange={(event) => setDispositionFilter(event.target.value)}>
                  <option value="all">All dispositions</option>
                  {dispositions.map((disposition) => (
                    <option key={disposition} value={disposition}>
                      {disposition}
                    </option>
                  ))}
                </select>
                <select className="admin-select" style={input} value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)}>
                  <option value="all">All agents</option>
                  {agents.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-scroll" style={{ marginTop: "20px", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "980px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#6d728d", textAlign: "left", fontSize: "13px", letterSpacing: "0.06em" }}>
                      {["REF ID", "AGENT", "STATUS", "DISPOSITION", "SUB-DISPOSITION", "LANGUAGE"].map((heading) => (
                        <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResponses.slice(0, 6).map((item) => {
                      const tone = statusTone(item.call_status);

                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                          <td style={{ padding: "14px 12px" }}>{item.reference_id}</td>
                          <td style={{ padding: "14px 12px" }}>{item.employee_name}</td>
                          <td style={{ padding: "14px 12px" }}>
                            <span style={{ display: "inline-flex", padding: "6px 12px", borderRadius: "999px", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}>
                              {item.call_status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 12px" }}>{item.disposition}</td>
                          <td style={{ padding: "14px 12px" }}>{item.sub_disposition || "NA"}</td>
                          <td style={{ padding: "14px 12px" }}>{item.language === "Other" ? item.language_other || "Other" : item.language}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>

            <form onSubmit={handleCreateAgent} style={{ ...panel, padding: "24px", alignSelf: "start", display: "grid", gap: "13px" }}>
              <h2 style={{ margin: 0, fontSize: "19px" }}>Create agent</h2>
              <input style={input} placeholder="Employee ID" value={agentForm.employeeId} onChange={(event) => setAgentForm((current) => ({ ...current, employeeId: event.target.value }))} />
              <input style={input} placeholder="Employee Name" value={agentForm.name} onChange={(event) => setAgentForm((current) => ({ ...current, name: event.target.value }))} />
              <input style={input} type="password" placeholder="Password" value={agentForm.password} onChange={(event) => setAgentForm((current) => ({ ...current, password: event.target.value }))} />
              <button type="submit" style={{ ...ghostButton, background: "rgba(168, 85, 247, 0.22)", borderColor: "rgba(168, 85, 247, 0.48)" }}>
                Create Agent
              </button>
              {feedback ? <div style={{ color: "#d9b7ff", fontSize: "14px" }}>{feedback}</div> : null}
            </form>
          </section>
            </>
          )}
        </main>
      </div>

      {editingAgent ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: "20px", background: "rgba(4, 3, 9, 0.72)" }}>
          <form onSubmit={handleUpdateAgent} style={{ ...panel, width: "100%", maxWidth: "520px", padding: "26px", display: "grid", gap: "14px", boxShadow: "0 28px 80px rgba(0,0,0,0.45)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "22px" }}>Edit agent</h2>
              <div style={{ marginTop: "8px", color: "#8f98b7", fontSize: "14px" }}>{editingAgent.name}</div>
            </div>
            <input style={input} placeholder="Agent name" value={editAgentForm.name} onChange={(event) => setEditAgentForm((current) => ({ ...current, name: event.target.value }))} />
            <input style={input} placeholder="Employee ID" value={editAgentForm.employeeId} onChange={(event) => setEditAgentForm((current) => ({ ...current, employeeId: event.target.value }))} />
            <input style={input} type="password" placeholder="New password (optional)" value={editAgentForm.password} onChange={(event) => setEditAgentForm((current) => ({ ...current, password: event.target.value }))} />
            <select className="admin-select" style={input} value={editAgentForm.role} onChange={(event) => setEditAgentForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="agent">agent</option>
              <option value="admin">admin</option>
            </select>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" onClick={closeAgentModal} disabled={isAgentActionLoading} style={{ ...ghostButton, opacity: isAgentActionLoading ? 0.55 : 1 }}>
                Cancel
              </button>
              <button type="submit" disabled={isAgentActionLoading} style={{ ...ghostButton, background: "rgba(168, 85, 247, 0.22)", borderColor: "rgba(168, 85, 247, 0.48)", opacity: isAgentActionLoading ? 0.55 : 1 }}>
                {isAgentActionLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deletingAgent ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: "20px", background: "rgba(4, 3, 9, 0.72)" }}>
          <div style={{ ...panel, width: "100%", maxWidth: "470px", padding: "26px", boxShadow: "0 28px 80px rgba(0,0,0,0.45)" }}>
            <h2 style={{ margin: 0, fontSize: "22px" }}>Delete agent?</h2>
            <div style={{ marginTop: "12px", color: "#aeb5d4", lineHeight: 1.5 }}>
              This will delete {deletingAgent.name}. This action needs confirmation.
            </div>
            <div style={{ marginTop: "22px", display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" onClick={closeAgentModal} disabled={isAgentActionLoading} style={{ ...ghostButton, opacity: isAgentActionLoading ? 0.55 : 1 }}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteAgent} disabled={isAgentActionLoading} style={{ ...ghostButton, color: "#ff7685", borderColor: "rgba(255, 118, 133, 0.42)", background: "rgba(255, 118, 133, 0.1)", opacity: isAgentActionLoading ? 0.55 : 1 }}>
                {isAgentActionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {forceLogoutTarget ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: "20px", background: "rgba(4, 3, 9, 0.72)" }}>
          <div style={{ ...panel, width: "100%", maxWidth: "470px", padding: "26px", boxShadow: "0 28px 80px rgba(0,0,0,0.45)" }}>
            <h2 style={{ margin: 0, fontSize: "22px" }}>Are you sure?</h2>
            <div style={{ marginTop: "12px", color: "#aeb5d4", lineHeight: 1.5 }}>
              {forceLogoutTarget.type === "all"
                ? "This will force logout all currently active agents. Your admin session will stay active."
                : `This will force logout ${forceLogoutTarget.agent.name} and close any active break safely.`}
            </div>
            <div style={{ marginTop: "22px", display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" onClick={closeAgentModal} disabled={isAgentActionLoading} style={{ ...ghostButton, opacity: isAgentActionLoading ? 0.55 : 1 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForceLogout}
                disabled={isAgentActionLoading}
                style={{
                  ...ghostButton,
                  color: "#ffb45c",
                  borderColor: "rgba(255, 180, 92, 0.42)",
                  background: "rgba(255, 180, 92, 0.1)",
                  opacity: isAgentActionLoading ? 0.55 : 1,
                }}
              >
                {isAgentActionLoading ? "Logging out..." : "Force Logout"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adminModalMode ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: "20px", background: "rgba(4, 3, 9, 0.72)" }}>
          <form onSubmit={saveManagedAdmin} className="admin-modal" style={{ ...panel, width: "100%", maxWidth: "540px", padding: "26px", boxShadow: "0 28px 80px rgba(0,0,0,0.45)" }}>
            <h2 style={{ margin: 0, fontSize: "22px" }}>{adminModalMode === "create" ? "Create Admin" : "Edit Admin"}</h2>
            <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
              <input style={input} value={adminForm.name} onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full Name" />
              {adminModalMode === "create" ? (
                <input style={input} value={adminForm.employeeId} onChange={(event) => setAdminForm((current) => ({ ...current, employeeId: event.target.value }))} placeholder="Employee ID" />
              ) : null}
              <input style={input} value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" type="email" />
              <input style={input} value={adminForm.password} onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))} placeholder={adminModalMode === "create" ? "Password" : "Password reset (optional)"} type="password" />
              <select className="admin-select" style={input} value={adminForm.role} onChange={(event) => setAdminForm((current) => ({ ...current, role: event.target.value }))} disabled>
                <option value="admin">admin</option>
              </select>
              {adminModalMode === "edit" ? (
                <select className="admin-select" style={input} value={adminForm.status} onChange={(event) => setAdminForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              ) : null}
            </div>
            <div style={{ marginTop: "22px", display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" onClick={closeAdminModal} disabled={isAdminActionLoading} style={{ ...ghostButton, opacity: isAdminActionLoading ? 0.55 : 1 }}>
                Cancel
              </button>
              <button type="submit" disabled={isAdminActionLoading} style={{ ...ghostButton, background: "rgba(168, 85, 247, 0.18)", borderColor: "rgba(168, 85, 247, 0.5)", opacity: isAdminActionLoading ? 0.55 : 1 }}>
                {isAdminActionLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isLogoutConfirmationOpen ? (
        <LogoutConfirmationModal onCancel={closeLogoutConfirmation} onConfirm={handleLogout} />
      ) : null}
    </div>
  );
};

export default AdminDashboard;

