import React, { useEffect, useMemo, useState } from "react";

import { registerUser } from "../../services/authService";
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

  return (
    <svg {...common}>
      <path d="M5 7H19M5 12H15M5 17H11" stroke="#aeb5d4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const statusTone = (status) => {
  if (status === "Connected") {
    return { color: "#26e6ad", bg: "rgba(38, 230, 173, 0.12)", border: "rgba(38, 230, 173, 0.34)" };
  }

  if (status === "Not Connected") {
    return { color: "#ff7685", bg: "rgba(255, 118, 133, 0.12)", border: "rgba(255, 118, 133, 0.34)" };
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

const AdminDashboard = () => {
  const { token, user } = useStore();
  const [activeView, setActiveView] = useState("overview");
  const [responses, setResponses] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dispositionFilter, setDispositionFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [responsePage, setResponsePage] = useState(1);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentStatusFilter, setAgentStatusFilter] = useState("all");
  const [agentViewMode, setAgentViewMode] = useState("grid");
  const [reportType, setReportType] = useState("daily");
  const [reportDateFrom, setReportDateFrom] = useState("2026-04-21");
  const [reportDateTo, setReportDateTo] = useState("2026-04-28");
  const [reportAgent, setReportAgent] = useState("all");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [agentForm, setAgentForm] = useState({
    employeeId: "",
    name: "",
    password: "",
  });

  const analytics = useMemo(() => {
    const totalCalls = responses.length;
    const connectedCalls = responses.filter((item) => item.call_status === "Connected").length;
    const notConnectedCalls = responses.filter((item) => item.call_status === "Not Connected").length;
    const positiveCalls = responses.filter((item) => item.disposition === "Positive" || item.disposition === "Already Positive").length;
    const activeAgents = new Set(responses.map((item) => item.employee_id).filter(Boolean)).size;

    return {
      totalCalls,
      connectedCalls,
      notConnectedCalls,
      positiveCalls,
      activeAgents,
      connectRate: totalCalls ? Math.round((connectedCalls / totalCalls) * 100) : 0,
      conversionRate: totalCalls ? Math.round((positiveCalls / totalCalls) * 100) : 0,
    };
  }, [responses]);

  const agents = useMemo(
    () =>
      Array.from(
        new Map(
          responses
            .filter((item) => item.employee_id)
            .map((item) => [item.employee_id, item.employee_name || item.employee_id])
        ).entries()
      ),
    [responses]
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
        item.employee_name?.toLowerCase().includes(term) ||
        item.employee_id?.toLowerCase().includes(term);
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
    const colors = ["#8b3ff4", "#168ba5", "#aa4b0f", "#24476f", "#24476f", "#5f1f72", "#8b3ff4", "#168ba5"];
    const byAgent = new Map();

    responses.forEach((item) => {
      const id = item.employee_id || "NA";
      const current = byAgent.get(id) || {
        id,
        name: item.employee_name || id,
        zohoId: item.zoho_id || "NA",
        calls: 0,
        connected: 0,
        positive: 0,
      };

      byAgent.set(id, {
        ...current,
        zohoId: item.zoho_id || current.zohoId,
        calls: current.calls + 1,
        connected: current.connected + (item.call_status === "Connected" ? 1 : 0),
        positive:
          current.positive +
          (item.disposition === "Positive" || item.disposition === "Already Positive" ? 1 : 0),
      });
    });

    return Array.from(byAgent.values())
      .sort((a, b) => b.calls - a.calls)
      .map((agent, index) => {
        const connectRate = agent.calls ? Math.round((agent.connected / agent.calls) * 100) : 0;
        const conversionRate = agent.calls ? Math.round((agent.positive / agent.calls) * 100) : 0;
        const status = index % 4 === 2 ? "On break" : "Online";
        const initials = agent.name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase();

        return {
          ...agent,
          initials: initials || "AG",
          connectRate,
          conversionRate,
          status,
          color: colors[index % colors.length],
          badge: index < 2 ? "Top" : status === "On break" ? "On break" : "Good",
        };
      });
  }, [responses]);

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
  const responsePageSize = 10;
  const totalResponsePages = Math.max(Math.ceil(filteredResponses.length / responsePageSize), 1);
  const currentResponsePage = Math.min(responsePage, totalResponsePages);
  const paginatedResponses = filteredResponses.slice(
    (currentResponsePage - 1) * responsePageSize,
    currentResponsePage * responsePageSize
  );
  const avgCallsPerAgent = analytics.activeAgents
    ? Math.round(analytics.totalCalls / analytics.activeAgents)
    : 0;
  const maxSubDisposition = Math.max(...subDispositionBreakdown.map((item) => item.value), 1);
  const maxAgentCalls = Math.max(...agentPerformance.map((item) => item.total), 1);
  const totalForDonut = Math.max(analytics.connectedCalls + analytics.notConnectedCalls + analytics.positiveCalls, 1);
  const connectedWidth = analytics.totalCalls ? Math.max((analytics.connectedCalls / analytics.totalCalls) * 100, 6) : 6;
  const notConnectedWidth = analytics.totalCalls ? Math.max((analytics.notConnectedCalls / analytics.totalCalls) * 100, 6) : 6;

  const loadResponses = async () => {
    try {
      const data = await getAllResponses(token);
      setResponses(data);
      setFeedback("");
    } catch (error) {
      setFeedback(error.message || "Unable to load admin data.");
    }
  };

  useEffect(() => {
    if (token) {
      loadResponses();
    }
  }, [token]);

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

  const clearResponseFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDispositionFilter("all");
    setAgentFilter("all");
    setLanguageFilter("all");
    setResponsePage(1);
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
          <title>${reportType} report</title>
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
          <h1>${reportType} report</h1>
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
        `}
      </style>

      <div style={{ display: "grid", gridTemplateColumns: "294px minmax(980px, 1fr)", minHeight: "100vh" }}>
        <aside
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
                <div style={{ fontSize: "20px", fontWeight: 700 }}>CallCenter AI</div>
                <div style={{ marginTop: "6px", color: "#a6a1bd", fontSize: "14px" }}>Admin Portal v2.0</div>
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
              ["responses", "All responses", "list"],
              ["agents", "Agents", "user"],
              ["reports", "Reports", "list"],
              ["export", "Export CSV", "download"],
            ].map(([id, label, icon]) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  if (id === "export") {
                    downloadResponsesExport(token);
                    return;
                  }

                  setActiveView(id);
                }}
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
            {iconFor("download")}
            Logout
          </button>
        </aside>

        <main className="admin-scroll" style={{ padding: "32px", overflowX: "auto" }}>
          {activeView === "analytics" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Analytics</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                    Detailed performance insights | All agents
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
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

              <section style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
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

              <section style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
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

              <section style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "18px" }}>
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

              <section style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "18px" }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
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

              <section style={{ marginTop: "34px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "18px" }}>
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
                    {filteredResponses.length} records
                  </span>
                </div>
                <div style={{ marginTop: "24px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />

                <div style={{ marginTop: "28px", display: "grid", gap: "14px" }}>
                  <input
                    style={{ ...input, fontSize: "24px", padding: "16px 20px" }}
                    placeholder="Search Ref ID, agent, remark..."
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
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
                    Showing {(currentResponsePage - 1) * responsePageSize + 1}-{Math.min(currentResponsePage * responsePageSize, filteredResponses.length)} of {filteredResponses.length}
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Agents</h1>
                  <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px", lineHeight: 1.15 }}>
                    Performance overview |<br /> All team members
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
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
                    <option value="Online">Online</option>
                    <option value="On break">On break</option>
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

              <section style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px" }}>
                {[
                  ["TOTAL AGENTS", agentCards.length, "#c681ff"],
                  ["ONLINE NOW", agentCards.filter((agent) => agent.status === "Online").length, "#35e5a7"],
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
                <section style={{ marginTop: "34px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "22px" }}>
                  {filteredAgentCards.length ? (
                    filteredAgentCards.map((agent) => (
                      <article key={agent.id} style={{ ...panel, padding: "36px", minHeight: "420px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "78px 1fr", gap: "20px", alignItems: "center" }}>
                          <div
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
                            <div style={{ marginTop: "8px", color: agent.status === "Online" ? "#35e5a7" : "#ffd02d", fontSize: "17px" }}>
                              ● {agent.status}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: "34px", display: "grid", gridTemplateColumns: "0.9fr 1.45fr 1.1fr", gap: "12px" }}>
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
                              color: agent.badge === "On break" ? "#ffd02d" : agent.badge === "Top" ? "#d9b7ff" : "#35e5a7",
                              border: `1px solid ${agent.badge === "On break" ? "rgba(255, 208, 45, 0.48)" : agent.badge === "Top" ? "rgba(168, 85, 247, 0.5)" : "rgba(53, 229, 167, 0.42)"}`,
                              background: agent.badge === "On break" ? "rgba(255, 208, 45, 0.1)" : agent.badge === "Top" ? "rgba(168, 85, 247, 0.16)" : "rgba(53, 229, 167, 0.12)",
                            }}
                          >
                            {agent.badge}
                          </span>
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
                  <table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#6d728d", letterSpacing: "0.06em" }}>
                        {["AGENT", "EMPLOYEE ID", "STATUS", "CALLS", "CONNECTED", "POSITIVE", "CONNECT RATE", "CONVERSION"].map((heading) => (
                          <th key={heading} style={{ padding: "14px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAgentCards.map((agent) => (
                        <tr key={agent.id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                          <td style={{ padding: "15px 14px" }}>{agent.name}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.id}</td>
                          <td style={{ padding: "15px 14px", color: agent.status === "Online" ? "#35e5a7" : "#ffd02d" }}>{agent.status}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.calls}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.connected}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.positive}</td>
                          <td style={{ padding: "15px 14px" }}>{agent.connectRate}%</td>
                          <td style={{ padding: "15px 14px" }}>{agent.conversionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          ) : activeView === "reports" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
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

              <section style={{ marginTop: "38px", display: "grid", gridTemplateColumns: "270px 350px", gap: "12px", maxWidth: "760px" }}>
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
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </section>

              <section style={{ ...panel, marginTop: "38px", padding: "36px 40px", maxWidth: "930px" }}>
                <h2 style={{ margin: 0, fontSize: "24px" }}>Report Configuration</h2>
                <div style={{ marginTop: "26px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />

                <div style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "24px", alignItems: "end" }}>
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
                    style={{ ...ghostButton, minWidth: "190px", minHeight: "60px", fontSize: "19px" }}
                  >
                    Generate
                  </button>
                </div>
              </section>

              {reportGenerated ? (
                <section style={{ ...panel, marginTop: "30px", padding: "30px 34px", maxWidth: "930px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "24px" }}>Report Preview</h2>
                      <div style={{ marginTop: "8px", color: "#9da6c3" }}>
                        {reportDateFrom} to {reportDateTo} | {reportRows.length} backend records
                      </div>
                    </div>
                    <button type="button" onClick={() => downloadReport("csv")} style={ghostButton}>
                      Download CSV
                    </button>
                  </div>

                  <section style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px" }}>
                    {reportKpis.map(([title, value, accent]) => (
                      <article key={title} style={{ background: "rgba(255,255,255,0.035)", borderRadius: "12px", padding: "18px" }}>
                        <div style={{ color: "#8f98b7", fontSize: "14px" }}>{title}</div>
                        <div style={{ marginTop: "10px", color: accent, fontSize: typeof value === "number" ? "30px" : "22px" }}>{value}</div>
                      </article>
                    ))}
                  </section>

                  <section style={{ marginTop: "26px" }}>
                    {reportType === "daily" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "18px" }}>
                        <article style={{ background: "rgba(255,255,255,0.025)", borderRadius: "14px", padding: "22px" }}>
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
                        <article style={{ background: "rgba(255,255,255,0.025)", borderRadius: "14px", padding: "22px" }}>
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
                      <article style={{ background: "rgba(255,255,255,0.025)", borderRadius: "14px", padding: "22px" }}>
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
                      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "18px" }}>
                        <article style={{ background: "rgba(255,255,255,0.025)", borderRadius: "14px", padding: "22px", display: "grid", placeItems: "center" }}>
                          <h3 style={{ justifySelf: "start", margin: 0 }}>Disposition doughnut</h3>
                          <div style={{ marginTop: "26px", width: "260px", height: "260px", borderRadius: "999px", background: "conic-gradient(#35e5a7 0 24%, #a855f7 24% 58%, #ff717e 58% 78%, #27d8ff 78% 100%)", display: "grid", placeItems: "center" }}>
                            <div style={{ width: "140px", height: "140px", borderRadius: "999px", background: "#121027", display: "grid", placeItems: "center", color: "#9da6c3" }}>
                              {reportRows.length}
                            </div>
                          </div>
                        </article>
                        <article style={{ background: "rgba(255,255,255,0.025)", borderRadius: "14px", padding: "22px" }}>
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
                      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "18px" }}>
                        <article style={{ background: "rgba(255,255,255,0.025)", borderRadius: "14px", padding: "22px" }}>
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
                        <article style={{ background: "rgba(255,255,255,0.025)", borderRadius: "14px", padding: "22px" }}>
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

                  <div className="admin-scroll" style={{ marginTop: "24px", overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: "820px", borderCollapse: "collapse" }}>
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
                              <td style={{ padding: "14px 12px", color: "#c681ff" }}>{item.reference_id}</td>
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
                </section>
              ) : null}
            </>
          ) : (
            <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Admin Dashboard</h1>
              <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
                {formatDate(new Date())} | All agents
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={loadResponses} style={ghostButton}>
                Filter
              </button>
              <button type="button" onClick={() => downloadResponsesExport(token)} style={ghostButton}>
                Export CSV
              </button>
            </div>
          </div>

          <section style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
            {[
              ["TOTAL CALLS TODAY", analytics.totalCalls, "All loaded responses", "#a855f7"],
              ["CONNECTED", analytics.connectedCalls, `${analytics.connectRate}% connect rate`, "#27d8ff"],
              ["POSITIVE / CONVERTED", analytics.positiveCalls, `${analytics.conversionRate}% conversion`, "#35e5a7"],
              ["ACTIVE AGENTS", analytics.activeAgents, `${Math.max(analytics.activeAgents - agentPerformance.length, 0)} on break`, "#ff717e"],
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

          <section style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "18px" }}>
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

          <section style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "18px" }}>
            <article style={{ ...panel, padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "19px" }}>Hourly call volume</h2>
                <span style={{ padding: "6px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                  Today
                </span>
              </div>
              <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.28)" }} />
              <svg viewBox="0 0 560 220" style={{ width: "100%", marginTop: "20px" }}>
                {[0, 1, 2, 3, 4].map((line) => (
                  <line key={line} x1="30" x2="535" y1={30 + line * 40} y2={30 + line * 40} stroke="rgba(132, 80, 255, 0.18)" />
                ))}
                <path d="M35 165 C80 130 90 78 130 72 S190 128 225 132 S285 72 325 82 S385 144 430 134 S492 102 530 118" fill="rgba(157, 78, 255, 0.12)" stroke="#a855f7" strokeWidth="4" />
                {[35, 130, 225, 325, 430, 530].map((x, index) => (
                  <circle key={x} cx={x} cy={[165, 72, 132, 82, 134, 118][index]} r="6" fill="#b568ff" />
                ))}
                {["9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM"].map((label, index) => (
                  <text key={label} x={30 + index * 82} y="210" fill="#555c76" fontSize="14" fontWeight="700">
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

          <section style={{ marginTop: "28px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "18px" }}>
            <article style={{ ...panel, padding: "28px", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "19px" }}>All responses</h2>
                <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#c693ff", border: "1px solid rgba(166, 108, 255, 0.44)", background: "rgba(122, 73, 255, 0.16)" }}>
                  {filteredResponses.length} total
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
                    {filteredResponses.map((item) => {
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
    </div>
  );
};

export default AdminDashboard;
