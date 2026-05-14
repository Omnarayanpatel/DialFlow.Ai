import React, { useEffect, useMemo, useState } from "react";

import AdminRanking from "../../components/ranking/AdminRanking";
import { deleteAgent, getAgentMonitoring, registerUser, updateAgent } from "../../services/authService";
import { downloadResponsesExport, getAllResponses } from "../../services/responseService";
import { useStore } from "../../store/useStore";

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

  if (status === "Connected" || value === "online") {
    return { color: "#26e6ad", bg: "rgba(38, 230, 173, 0.12)", border: "rgba(38, 230, 173, 0.34)" };
  }

  if (status === "Not Connected" || value === "offline") {
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

const AdminDashboard = () => {
  const { token, user } = useStore();
  const [activeView, setActiveView] = useState("overview");
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportHistory, setExportHistory] = useState([]);
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
  const [isAgentActionLoading, setIsAgentActionLoading] = useState(false);
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
  const [exportDateFrom, setExportDateFrom] = useState("2026-04-21");
  const [exportDateTo, setExportDateTo] = useState("2026-04-28");
  const [exportStatus, setExportStatus] = useState("all");
  const [exportDisposition, setExportDisposition] = useState("all");
  const [exportAgent, setExportAgent] = useState("all");
  const [exportLanguage, setExportLanguage] = useState("all");
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportColumns, setExportColumns] = useState([
    "reference_id",
    "employee_id",
    "employee_name",
    "call_status",
    "disposition",
    "sub_disposition",
    "language",
    "remark",
    "created_at",
  ]);
  const [agentForm, setAgentForm] = useState({
    employeeId: "",
    name: "",
    password: "",
  });

  useEffect(() => {
    document.title = "Admin Dashboard | Dialflow.ai";
  }, []);

  const exportColumnOptions = [
    ["reference_id", "Ref ID"],
    ["employee_id", "Employee ID"],
    ["employee_name", "Agent Name"],
    ["zoho_id", "Zoho ID"],
    ["call_status", "Call Status"],
    ["disposition", "Disposition"],
    ["sub_disposition", "Sub-Disposition"],
    ["language", "Language"],
    ["language_other", "Language (Other)"],
    ["remark", "Remark"],
    ["created_at", "Date & Time"],
    ["date_only", "Date only"],
  ];

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
      conversionRate: totalCalls ? Math.round((positiveCalls / totalCalls) * 100) : 0,
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
        conversionRate: stats.calls ? Math.round((stats.positive / stats.calls) * 100) : 0,
        status: normalizeAgentStatus(agent.status),
        loginTime: agent.login_time || null,
        activeSessionDuration: agent.active_session_duration || 0,
        breakCount: agent.break_count || 0,
        totalBreakDuration: agent.total_break_duration || 0,
        currentBreakDuration: agent.current_break_duration || 0,
        activeSessionCount: agent.active_session_count || 0,
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
    const from = reportDateFrom ? new Date(`${reportDateFrom}T00:00:00`) : null;
    const to = reportDateTo ? new Date(`${reportDateTo}T23:59:59`) : null;

    return responses.filter((item) => {
      const createdAt = item.created_at ? new Date(item.created_at) : null;
      const matchesFrom = !from || (createdAt && createdAt >= from);
      const matchesTo = !to || (createdAt && createdAt <= to);
      const matchesAgent = reportAgent === "all" || item.employee_id === reportAgent;

      return matchesFrom && matchesTo && matchesAgent;
    });
  }, [reportAgent, reportDateFrom, reportDateTo, responses]);

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

  const exportRows = useMemo(() => {
    const from = exportDateFrom ? new Date(`${exportDateFrom}T00:00:00`) : null;
    const to = exportDateTo ? new Date(`${exportDateTo}T23:59:59`) : null;

    return responses.filter((item) => {
      const createdAt = item.created_at ? new Date(item.created_at) : null;
      const languageValue = item.language === "Other" ? item.language_other || "Other" : item.language;
      const matchesFrom = !from || (createdAt && createdAt >= from);
      const matchesTo = !to || (createdAt && createdAt <= to);
      const matchesStatus = exportStatus === "all" || item.call_status === exportStatus;
      const matchesDisposition = exportDisposition === "all" || item.disposition === exportDisposition;
      const matchesAgent = exportAgent === "all" || item.employee_id === exportAgent;
      const matchesLanguage = exportLanguage === "all" || languageValue === exportLanguage;

      return matchesFrom && matchesTo && matchesStatus && matchesDisposition && matchesAgent && matchesLanguage;
    });
  }, [
    exportAgent,
    exportDateFrom,
    exportDateTo,
    exportDisposition,
    exportLanguage,
    exportStatus,
    responses,
  ]);

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
      conversionRate: total ? Math.round((positive / total) * 100) : 0,
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
        conversionRate: agent.total ? Math.round((agent.positive / agent.total) * 100) : 0,
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
  const totalForDonut = Math.max(analytics.connectedCalls + analytics.notConnectedCalls + analytics.positiveCalls, 1);
  const connectedWidth = analytics.totalCalls ? Math.max((analytics.connectedCalls / analytics.totalCalls) * 100, 6) : 6;
  const notConnectedWidth = analytics.totalCalls ? Math.max((analytics.notConnectedCalls / analytics.totalCalls) * 100, 6) : 6;

  const hourlyCounts = useMemo(() => {
    const todayStr = new Date().toDateString();
    const hours = ["09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"];
    return hours.map(hour => {
      return responses.filter(r => {
        if (!r.created_at) return false;
        const date = new Date(r.created_at);
        return date.toDateString() === todayStr && 
               date.getHours().toString().padStart(2, '0') === hour;
      }).length;
    });
  }, [responses]);

  const maxHourlyCount = Math.max(1000, ...hourlyCounts);
  const hourlyLabels = ["9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM"];

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

  const loadAgents = async () => {
    try {
      const data = await getAgentMonitoring(token);
      setAllAgents(data);
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  };

  useEffect(() => {
    if (token) {
      loadResponses();
      loadAgents();

      const interval = setInterval(() => {
        loadResponses();
        loadAgents();
      }, 5000); // 5 सेकंड में रियल-टाइम अपडेट के लिए

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

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
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

  const toggleExportColumn = (column) => {
    setExportColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  };

  const selectAllExportColumns = () => {
    setExportColumns(exportColumnOptions.map(([key]) => key));
  };

  const clearExportColumns = () => {
    setExportColumns([]);
  };

  const exportValueFor = (item, column) => {
    if (column === "language") {
      return item.language === "Other" ? item.language_other || "Other" : item.language || "";
    }

    if (column === "date_only") {
      return item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN") : "";
    }

    if (column === "created_at") {
      return item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "";
    }

    return item[column] || "";
  };

  const downloadCustomExport = async (format = exportFormat) => {
    const selectedOptions = exportColumnOptions.filter(([key]) => exportColumns.includes(key));

    if (!selectedOptions.length) {
      setFeedback("Export ke liye kam se kam ek column select karein.");
      return;
    }

    setIsExporting(true);
    setExportProgress(10);

    // Simulate export steps
    setTimeout(() => setExportProgress(45), 600);
    setTimeout(() => setExportProgress(80), 1200);

    const escapeCsv = (value) => {
      if (value === null || value === undefined) {
        return "";
      }

      const text = String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    setTimeout(() => {
      const fileStamp = `${exportDateFrom || "all"}-${exportDateTo || "all"}`;
      const headers = selectedOptions.map(([, label]) => label);
      const rows = exportRows.map((item) => selectedOptions.map(([key]) => exportValueFor(item, key)));
      
      const content =
        format === "excel"
          ? `
            <html>
              <head><meta charset="utf-8" /></head>
              <body>
                <table border="1">
                  <thead><tr>${headers.map((heading) => `<th>${heading}</th>`).join("")}</tr></thead>
                  <tbody>
                    ${rows.map((row) => `<tr>${row.map((value) => `<td>${value}</td>`).join("")}</tr>`).join("")}
                  </tbody>
                </table>
              </body>
            </html>
          `
          : [headers.map(escapeCsv).join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");
          
      const blob = new Blob([content], {
        type: format === "excel" ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `call_data_${fileStamp}.${format === "excel" ? "xls" : "csv"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      
      // Add to History
      const newRecord = {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        format: format.toUpperCase(),
        rows: exportRows.length,
        agent: user.name,
      };
      setExportHistory(prev => [newRecord, ...prev]);
      setFeedback("");

      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 600);
    }, 1800);
  };

  const buildReportTableRows = () =>
    reportRows
      .map(
        (item) => `
          <tr>
            <td>${item.reference_id || ""}</td>
            <td>${item.employee_name || ""}</td>
            <td>${item.call_status || ""}</td>
            <td>${item.disposition || ""}</td>
            <td>${item.sub_disposition || ""}</td>
            <td>${item.language === "Other" ? item.language_other || "Other" : item.language || ""}</td>
            <td>${item.remark || ""}</td>
          </tr>
        `
      )
      .join("");

  const downloadReport = (format = "csv") => {
    const headers = [
      "report_type",
      "created_at",
      "employee_id",
      "employee_name",
      "reference_id",
      "call_status",
      "disposition",
      "sub_disposition",
      "language",
      "remark",
    ];
    const escapeCsv = (value) => {
      if (value === null || value === undefined) {
        return "";
      }

      const text = String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = reportRows.map((item) =>
      [
        reportType,
        item.created_at,
        item.employee_id,
        item.employee_name,
        item.reference_id,
        item.call_status,
        item.disposition,
        item.sub_disposition,
        item.language === "Other" ? item.language_other || "Other" : item.language,
        item.remark,
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
                    <th>Ref ID</th><th>Agent</th><th>Status</th><th>Disposition</th>
                    <th>Sub-disposition</th><th>Language</th><th>Remark</th>
                  </tr>
                </thead>
                <tbody>${buildReportTableRows()}</tbody>
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
  };

  const printReport = () => {
    const printWindow = window.open("", "_blank", "width=1100,height=800");

    if (!printWindow) {
      return;
    }

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
          <div>${reportDateFrom} to ${reportDateTo} | ${reportRows.length} records</div>
          <div class="kpis">
            ${reportKpis
              .map(([label, value]) => `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div></div>`)
              .join("")}
          </div>
          <table>
            <thead>
              <tr>
                <th>Ref ID</th><th>Agent</th><th>Status</th><th>Disposition</th>
                <th>Sub-disposition</th><th>Language</th><th>Remark</th>
              </tr>
            </thead>
            <tbody>${buildReportTableRows()}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div style={shell}>
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
            .admin-mini-grid,
            .admin-export-actions {
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
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(145, 73, 255, 0.22)",
                  border: "1px solid rgba(177, 107, 255, 0.52)",
                }}
              >
                <span style={{ color: "#c88cff", fontSize: "22px" }}>*</span>
              </div>
              <div>
                <div style={{ fontSize: "20px", fontWeight: 700 }}>Dialflow.ai</div>
                <div style={{ marginTop: "6px", color: "#a6a1bd", fontSize: "14px" }}>Powered by Dhritii.ai</div>
              </div>
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
              <div style={{ marginTop: "6px", color: "#aaa3c2" }}>Admin | Team Lead</div>
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
                Admin
              </div>
            </div>
          </div>

          <div style={{ padding: "16px 28px 8px", color: "#5f6076", letterSpacing: "0.08em", fontSize: "13px" }}>
            ANALYTICS
          </div>

          <nav>
            {[
              ["overview", "Overview", "grid"],
              ["analytics", "Analytics", "chart"],
              ["ranking", "Ranking", "chart"],
              ["responses", "All responses", "list"],
              ["agents", "Agents", "user"],
              ["reports", "Reports", "list"],
              ["export", "Export", "download"],
            ].map(([id, label, icon]) => (
              <button
                type="button"
                key={label}
                onClick={() => setActiveView(id)}
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
            onClick={handleLogout}
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
          {activeView === "ranking" ? (
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
                  <select className="admin-select" style={{ ...input, width: "190px" }} defaultValue="today">
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                  </select>
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
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>All responses</h1>
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
                        {["#REF ID ↕", "AGENT ↕", "STATUS ↕", "DISPOSITION ↕", "SUB-DISP", "LANGUAGE", "REMARK"].map((heading) => (
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
                            <td style={{ padding: "17px 14px", color: "#7d849f", maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.remark || "-"}</td>
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
                  ["AVG CONNECT RATE", `${agentCards.length ? Math.round(agentCards.reduce((sum, agent) => sum + agent.connectRate, 0) / agentCards.length) : 0}%`, "#27d8ff"],
                  ["TOP PERFORMER", agentCards[0]?.name || "NA", "#ffd02d"],
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
                            ["SESSION", formatDuration(agent.activeSessionDuration), "#ffd02d"],
                            ["BREAKS", agent.breakCount, "#ffa500"],
                            ["BREAK TIME", formatDuration(agent.totalBreakDuration), "#ffb45c"],
                            ["CURRENT BREAK", agent.status === "break" ? formatDuration(agent.currentBreakDuration) : "00:00:00", "#ff7685"],
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
                        {["AGENT", "EMPLOYEE ID", "STATUS", "LOGIN", "SESSION", "BREAKS", "BREAK TIME", "CURRENT BREAK", "CALLS", "CONNECTED", "POSITIVE", "CONNECT RATE", "CONVERSION", "ACTIONS"].map((heading) => (
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
                          <td style={{ padding: "15px 14px" }}>{formatDuration(agent.activeSessionDuration)}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.breakCount}</td>
                          <td style={{ padding: "15px 14px" }}>{formatDuration(agent.totalBreakDuration)}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.status === "break" ? formatDuration(agent.currentBreakDuration) : "00:00:00"}</td>
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
                  <button type="button" onClick={() => downloadReport("csv")} style={ghostButton}>
                    Download CSV
                  </button>
                  <button type="button" onClick={() => downloadReport("excel")} style={ghostButton}>
                    Download Excel
                  </button>
                  <button type="button" onClick={printReport} style={ghostButton}>
                    Print / PDF
                  </button>
                </div>
              </div>

              <section className="admin-filter-grid" style={{ marginTop: "38px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px", maxWidth: "760px" }}>
                {[
                  ["daily", "Daily Report", "🗓"],
                  ["agent", "Agent-wise Report", "👤"],
                  ["disposition", "Disposition Report", "📊"],
                  ["conversion", "Conversion Report", "🎯"],
                ].map(([id, label, icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setReportType(id);
                      setReportGenerated(false);
                    }}
                    style={{
                      ...ghostButton,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      minHeight: "72px",
                      fontSize: "24px",
                      borderColor: reportType === id ? "rgba(168, 85, 247, 0.78)" : "rgba(154, 145, 176, 0.44)",
                      background: reportType === id ? "rgba(122, 73, 255, 0.16)" : "transparent",
                    }}
                    className="admin-action-button"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "28px 32px", maxWidth: "930px" }}>
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
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "38px", padding: "32px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "24px" }}>Report Configuration</h2>
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
                    onClick={() => setReportGenerated(true)}
                    style={{ ...ghostButton, minWidth: "190px", minHeight: "60px", fontSize: "19px", background: "rgba(168, 85, 247, 0.18)", borderColor: "rgba(168, 85, 247, 0.5)" }}
                    className="admin-action-button"
                  >
                    Generate
                  </button>
                </div>
              </section>

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
                    <table className="admin-polished-table" style={{ width: "100%", minWidth: "820px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#6d728d", textAlign: "left", letterSpacing: "0.05em" }}>
                          {["REF ID", "AGENT", "STATUS", "DISPOSITION", "SUB-DISP", "LANGUAGE"].map((heading) => (
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
                        {!reportRows.length ? (
                          <tr>
                            <td colSpan="6" style={{ padding: "22px 12px" }}>
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
          ) : activeView === "export" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Export Data</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                    Download call data as CSV or Excel with custom filters & columns
                  </div>
                </div>
                <span style={{ padding: "8px 18px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                  {exportRows.length} rows selected
                </span>
              </div>

              {isLoadingResponses ? (
                <div style={{ marginTop: "32px", textAlign: "center", color: "#aeb5d4", fontSize: "18px" }}>
                  <div style={{
                    border: "4px solid rgba(168, 85, 247, 0.2)",
                    borderTop: "4px solid #a855f7",
                    borderRadius: "50%",
                    width: "40px",
                    height: "40px",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 16px auto"
                  }} />
                  Loading responses...
                </div>
              ) : (
              <>
              <section className="admin-filter-grid" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px", maxWidth: "860px" }}>
                {[
                  ["csv", "CSV Export", "Comma-separated values - compatible with Google Sheets, any spreadsheet, and data tools.", ".csv"],
                  ["excel", "Excel Export", "Multi-sheet Excel file style - opens in Microsoft Excel and spreadsheet apps.", ".xls"],
                ].map(([id, title, description, tag]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setExportFormat(id)}
                    style={{
                      ...panel,
                      minHeight: "210px",
                      padding: "28px",
                      textAlign: "left",
                      cursor: "pointer",
                      borderColor: exportFormat === id ? "#a855f7" : "rgba(132, 80, 255, 0.34)",
                      background: exportFormat === id ? "#18102f" : "#121027",
                      position: "relative",
                    }}
                    className="admin-hover-card"
                  >
                    {exportFormat === id ? (
                      <span style={{ position: "absolute", right: "18px", top: "18px", width: "28px", height: "28px", borderRadius: "999px", display: "grid", placeItems: "center", background: "#8b3ff4", color: "#fff", fontWeight: 700 }}>
                        ✓
                      </span>
                    ) : null}
                    <div style={{ width: "54px", height: "54px", borderRadius: "12px", display: "grid", placeItems: "center", background: id === "csv" ? "rgba(139, 63, 244, 0.24)" : "rgba(38, 230, 173, 0.12)", fontSize: "28px" }}>
                      {id === "csv" ? "▤" : "▥"}
                    </div>
                    <h2 style={{ margin: "20px 0 0", color: "#f4f0ff", fontSize: "21px" }}>{title}</h2>
                    <p style={{ margin: "10px 0 0", color: "#9da6c3", lineHeight: 1.45, fontSize: "15px" }}>{description}</p>
                    <span style={{ display: "inline-flex", marginTop: "16px", padding: "6px 13px", borderRadius: "999px", color: "#7d849f", border: "1px solid rgba(122, 73, 255, 0.34)", background: "rgba(122, 73, 255, 0.12)" }}>
                      {tag}
                    </span>
                  </button>
                ))}
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "28px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "19px" }}>Filters</h2>
                  <button type="button" onClick={() => { setExportStatus("all"); setExportDisposition("all"); setExportAgent("all"); setExportLanguage("all"); }} className="admin-action-button" style={{ ...ghostButton, padding: "8px 16px", fontSize: "14px" }}>
                    All data selected
                  </button>
                </div>
                <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                <div className="admin-kpi-grid" style={{ marginTop: "22px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "18px" }}>
                  <label style={{ color: "#9da6c3", fontSize: "13px", textTransform: "uppercase" }}>
                    Date from
                    <input type="date" style={{ ...input, marginTop: "8px" }} value={exportDateFrom} onChange={(event) => setExportDateFrom(event.target.value)} />
                  </label>
                  <label style={{ color: "#9da6c3", fontSize: "13px", textTransform: "uppercase" }}>
                    Date to
                    <input type="date" style={{ ...input, marginTop: "8px" }} value={exportDateTo} onChange={(event) => setExportDateTo(event.target.value)} />
                  </label>
                  <label style={{ color: "#9da6c3", fontSize: "13px", textTransform: "uppercase" }}>
                    Call status
                    <select className="admin-select" style={{ ...input, marginTop: "8px" }} value={exportStatus} onChange={(event) => setExportStatus(event.target.value)}>
                      <option value="all">All</option>
                      <option value="Connected">Connected</option>
                      <option value="Not Connected">Not Connected</option>
                    </select>
                  </label>
                  <label style={{ color: "#9da6c3", fontSize: "13px", textTransform: "uppercase" }}>
                    Disposition
                    <select className="admin-select" style={{ ...input, marginTop: "8px" }} value={exportDisposition} onChange={(event) => setExportDisposition(event.target.value)}>
                      <option value="all">All</option>
                      {dispositions.map((disposition) => (
                        <option key={disposition} value={disposition}>{disposition}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ color: "#9da6c3", fontSize: "13px", textTransform: "uppercase" }}>
                    Agent
                    <select className="admin-select" style={{ ...input, marginTop: "8px" }} value={exportAgent} onChange={(event) => setExportAgent(event.target.value)}>
                      <option value="all">All agents</option>
                      {agents.map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ color: "#9da6c3", fontSize: "13px", textTransform: "uppercase" }}>
                    Language
                    <select className="admin-select" style={{ ...input, marginTop: "8px" }} value={exportLanguage} onChange={(event) => setExportLanguage(event.target.value)}>
                      <option value="all">All</option>
                      {languageBreakdown.map((language) => (
                        <option key={language.label} value={language.label}>{language.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "28px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "19px" }}>Select columns to export</h2>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button type="button" onClick={selectAllExportColumns} className="admin-action-button" style={{ ...ghostButton, padding: "8px 16px", fontSize: "14px" }}>Select all</button>
                    <button type="button" onClick={clearExportColumns} className="admin-action-button" style={{ ...ghostButton, padding: "8px 16px", fontSize: "14px", color: "#7d849f" }}>Clear all</button>
                  </div>
                </div>
                <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                <div className="admin-filter-grid" style={{ marginTop: "22px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
                  {exportColumnOptions.map(([key, label]) => {
                    const checked = exportColumns.includes(key);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleExportColumn(key)}
                        style={{
                          minHeight: "64px",
                          borderRadius: "10px",
                          border: checked ? "1px solid #a855f7" : "1px solid rgba(122, 73, 255, 0.34)",
                          background: checked ? "rgba(122, 73, 255, 0.16)" : "rgba(255,255,255,0.025)",
                          color: checked ? "#f4f0ff" : "#9da6c3",
                          display: "flex",
                          gap: "10px",
                          alignItems: "center",
                          padding: "12px",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ width: "18px", height: "18px", borderRadius: "5px", display: "grid", placeItems: "center", flex: "0 0 auto", background: checked ? "#8b3ff4" : "transparent", border: checked ? "1px solid #8b3ff4" : "1px solid rgba(154, 145, 176, 0.44)", color: "#fff", fontSize: "12px" }}>
                          {checked ? "✓" : ""}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "28px", maxWidth: "930px", overflow: "hidden" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "19px" }}>Data preview</h2>
                  <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                    {exportRows.length} rows
                  </span>
                </div>
                <div className="admin-scroll" style={{ marginTop: "22px", overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(122, 73, 255, 0.18)" }}>
                  <table className="admin-polished-table" style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#6d728d", textAlign: "left", fontSize: "13px", letterSpacing: "0.06em" }}>
                        {exportColumnOptions.filter(([key]) => exportColumns.includes(key)).map(([key, label]) => (
                          <th key={key} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {exportColumns.length ? exportRows.slice(0, 8).map((item) => {
                        return (
                          <tr key={item.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                            {exportColumnOptions.filter(([key]) => exportColumns.includes(key)).map(([key]) => (
                              <td key={key} style={{ padding: "14px 12px", color: key === "reference_id" ? "#c681ff" : "#aeb5d4" }}>
                                {exportValueFor(item, key)}
                              </td>
                            ))}
                          </tr>
                        );
                      }) : null}
                      {!exportColumns.length || !exportRows.length ? (
                        <tr>
                          <td colSpan={Math.max(exportColumns.length, 1)} style={{ padding: "22px 12px" }}>
                            <div className="admin-empty-state">
                              {!exportColumns.length ? "Select at least one column to preview export data." : "No rows match the selected export filters."}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "28px", maxWidth: "930px" }}>
                <div className="admin-section-heading">
                  <h2 style={{ margin: 0, fontSize: "19px" }}>Export</h2>
                  <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                    {exportFormat.toUpperCase()} · {exportRows.length} rows · {exportColumns.length} columns
                  </span>
                </div>
                <div style={{ marginTop: "22px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                
                {isExporting && (
                  <div style={{ marginTop: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "#d9b7ff" }}>
                      <span>Preparing {exportFormat.toUpperCase()} file...</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <div style={{ height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${exportProgress}%`, background: "linear-gradient(90deg, #7c34f2, #a855f7)", transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                )}

                <div className="admin-export-actions" style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" }}>
                  <button 
                    type="button" 
                    disabled={isExporting}
                    onClick={() => downloadCustomExport("csv")} 
                    className="admin-action-button"
                    style={{ ...ghostButton, minHeight: "74px", fontSize: "18px", opacity: isExporting ? 0.5 : 1, background: "rgba(168, 85, 247, 0.18)", borderColor: "rgba(168, 85, 247, 0.5)" }}
                  >
                    {isExporting && exportFormat === "csv" ? "Exporting..." : "Download CSV"}
                  </button>
                  <button 
                    type="button" 
                    disabled={isExporting}
                    onClick={() => downloadCustomExport("excel")} 
                    className="admin-action-button"
                    style={{ ...ghostButton, minHeight: "74px", fontSize: "18px", opacity: isExporting ? 0.5 : 1, background: "rgba(38, 230, 173, 0.08)", borderColor: "rgba(38, 230, 173, 0.28)" }}
                  >
                    {isExporting && exportFormat === "excel" ? "Exporting..." : "Download Excel (.xls)"}
                  </button>
                </div>
                {feedback ? <div style={{ marginTop: "16px", color: "#d9b7ff" }}>{feedback}</div> : null}
              </section>

              <section className="admin-soft-panel" style={{ ...panel, marginTop: "30px", padding: "28px", maxWidth: "930px" }}>
                <h2 style={{ margin: 0, fontSize: "19px" }}>Recent Export History</h2>
                <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
                <div style={{ marginTop: "18px" }}>
                  {exportHistory.length > 0 ? (
                    <div className="admin-scroll" style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(122, 73, 255, 0.18)" }}>
                    <table className="admin-polished-table" style={{ width: "100%", minWidth: "560px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#6d728d", textAlign: "left", fontSize: "13px" }}>
                          <th style={{ padding: "10px" }}>Time</th>
                          <th style={{ padding: "10px" }}>Format</th>
                          <th style={{ padding: "10px" }}>Rows</th>
                          <th style={{ padding: "10px" }}>Exported By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exportHistory.map(h => (
                          <tr key={h.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "10px" }}>{h.time}</td>
                            <td style={{ padding: "10px", color: "#35e5a7" }}>{h.format}</td>
                            <td style={{ padding: "10px" }}>{h.rows}</td>
                            <td style={{ padding: "10px", color: "#d39cff" }}>{h.agent}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  ) : (
                    <div className="admin-empty-state">No recent export history</div>
                  )}
                </div>
              </section>
              </>
              )} {/* End of isLoadingResponses conditional rendering */}
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
              <button type="button" onClick={loadResponses} style={ghostButton}>
                Filter
              </button>
              <button type="button" onClick={() => downloadResponsesExport(token)} style={ghostButton}>
                Export CSV
              </button>
            </div>
          </div>

          <section className="admin-kpi-grid" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "16px" }}>
            {[
              ["TOTAL CALLS TODAY", analytics.totalCalls, "created_at::date = CURRENT_DATE", "#a855f7"],
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

          <section className="admin-two-grid" style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "18px" }}>
            <article style={{ ...panel, padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "19px" }}>Call status breakdown</h2>
                <span style={{ padding: "6px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                  Today
                </span>
              </div>
              <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
              <div style={{ marginTop: "24px", display: "flex", alignItems: "end", gap: "46px", height: "220px", paddingLeft: "70px" }}>
                <div style={{ width: "140px", height: `${connectedWidth}%`, maxHeight: "190px", minHeight: "32px", borderRadius: "8px", background: "linear-gradient(180deg, #9c4dff, #7c34f2)" }} />
                <div style={{ width: "140px", height: `${notConnectedWidth}%`, maxHeight: "190px", minHeight: "32px", borderRadius: "8px", background: "#3e485b" }} />
              </div>
              <div style={{ display: "flex", gap: "58px", marginLeft: "78px", color: "#666d83", fontWeight: 700 }}>
                <span>Connected</span>
                <span>Not Connected</span>
              </div>
            </article>

            <article style={{ ...panel, padding: "28px", overflow: "hidden" }}>
              <h2 style={{ margin: 0, fontSize: "19px" }}>Disposition distribution</h2>
              <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
              <div style={{ marginTop: "28px", display: "grid", placeItems: "center" }}>
                <div
                  style={{
                    width: "210px",
                    height: "210px",
                    borderRadius: "999px",
                    background: `conic-gradient(#25d8ef 0 ${(analytics.connectedCalls / totalForDonut) * 100}%, #ff717e 0 ${((analytics.connectedCalls + analytics.notConnectedCalls) / totalForDonut) * 100}%, #35e5a7 0 100%)`,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <div style={{ width: "112px", height: "112px", borderRadius: "999px", background: "#121027", display: "grid", placeItems: "center", color: "#aeb5d4" }}>
                    {analytics.totalCalls}
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="admin-two-grid" style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "18px" }}>
            <article style={{ ...panel, padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "19px" }}>Hourly call volume</h2>
                <span style={{ padding: "6px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                  Today
                </span>
              </div>
              <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
              <svg viewBox="0 0 560 230" style={{ width: "100%", marginTop: "20px" }}>
                {/* Y-axis labels and grid lines */}
                {[0, 1, 2, 3, 4].map((i) => {
                  const y = 30 + i * 40;
                  const label = Math.round(maxHourlyCount - (i * maxHourlyCount) / 4);
                  return (
                    <React.Fragment key={i}>
                      <text x="0" y={y + 4} fill="#555c76" fontSize="10" fontWeight="700">{label}</text>
                      <line x1="35" x2="535" y1={y} y2={y} stroke="rgba(132, 80, 255, 0.18)" />
                    </React.Fragment>
                  );
                })}
                
                {/* Area under the line */}
                <path 
                  d={(() => {
                    const pts = hourlyCounts.map((count, i) => ({ x: 40 + i * 49, y: 190 - (count / maxHourlyCount) * 160 }));
                    if (!pts.length) return "";
                    let d = `M ${pts[0].x} ${pts[0].y}`;
                    if (pts.length > 1) {
                      d += ` C ${pts[0].x + 20} ${pts[0].y} ${pts[1].x - 20} ${pts[1].y} ${pts[1].x} ${pts[1].y}`;
                      for (let i = 2; i < pts.length; i++) d += ` S ${pts[i].x - 20} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
                    }
                    return d + ` L ${pts[pts.length - 1].x} 190 L ${pts[0].x} 190 Z`;
                  })()}
                  fill="rgba(157, 78, 255, 0.12)"
                />
                {/* Trend line */}
                <path
                  d={(() => {
                    const pts = hourlyCounts.map((count, i) => ({ x: 40 + i * 49, y: 190 - (count / maxHourlyCount) * 160 }));
                    if (!pts.length) return "";
                    let d = `M ${pts[0].x} ${pts[0].y}`;
                    if (pts.length > 1) {
                      d += ` C ${pts[0].x + 20} ${pts[0].y} ${pts[1].x - 20} ${pts[1].y} ${pts[1].x} ${pts[1].y}`;
                      for (let i = 2; i < pts.length; i++) d += ` S ${pts[i].x - 20} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
                    }
                    return d;
                  })()}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="4"
                />
                {hourlyCounts.map((count, i) => {
                  const x = 40 + i * 49;
                  const y = 190 - (count / maxHourlyCount) * 160;
                  return <circle key={i} cx={x} cy={y} r="6" fill="#b568ff" />;
                })}
                {hourlyLabels.map((label, index) => (
                  <text key={label} x={35 + index * 49} y="215" fill="#555c76" fontSize="10" fontWeight="700">
                    {label}
                  </text>
                ))}
              </svg>
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
    </div>
  );
};

export default AdminDashboard;
