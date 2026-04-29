import React, { useEffect, useMemo, useState } from "react";

import { createAgentResponse, getAgentDashboardData } from "../../services/responseService";
import { useStore } from "../../store/useStore";

const sidebarMenu = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
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

const fallbackSummary = {
  totalCalls: 48,
  connectedCalls: 31,
  notConnectedCalls: 17,
  positiveCalls: 5,
};

const fallbackRows = [
  {
    refId: "REF-1092",
    status: "Connected",
    disposition: "Positive",
    subDisposition: "NA",
  },
  {
    refId: "REF-1091",
    status: "Connected",
    disposition: "Call Back",
    subDisposition: "Want Callback by Evening",
  },
  {
    refId: "REF-1090",
    status: "Not Connected",
    disposition: "RNR",
    subDisposition: "NA",
  },
];

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

const formatTime = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);

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

  if (type === "profile") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#b585ff" strokeWidth="2" />
        <path d="M5 19C6.8 15.8 9 14.5 12 14.5C15 14.5 17.2 15.8 19 19" stroke="#b585ff" strokeWidth="2" strokeLinecap="round" />
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
  const [activeView, setActiveView] = useState("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loginTime] = useState(() => {
    const storedLoginTime = sessionStorage.getItem("agentLoginTime");

    if (storedLoginTime) {
      return new Date(storedLoginTime);
    }

    const now = new Date();
    sessionStorage.setItem("agentLoginTime", now.toISOString());
    return now;
  });

  // Session-based Agent Info state (to be filled once upon login)
  const [empId, setEmpId] = useState(user.employeeId || "");
  const [empName, setEmpName] = useState(user.name || "");
  const [zohoId, setZohoId] = useState(user.zohoId || "");
  const [dialerId, setDialerId] = useState(user.dialerId || "");
  const [isInfoLocked, setIsInfoLocked] = useState(false);

  const [referenceId, setReferenceId] = useState("");
  const [callStatus, setCallStatus] = useState("Connected");
  const [callStatusOther, setCallStatusOther] = useState("");
  const [language, setLanguage] = useState("NA");
  const [languageOther, setLanguageOther] = useState("");
  const [disposition, setDisposition] = useState("Positive");
  const [dispositionOther, setDispositionOther] = useState("");
  const [subDisposition, setSubDisposition] = useState("NA");
  const [subDispositionOther, setSubDispositionOther] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState(fallbackSummary);
  const [rows, setRows] = useState(fallbackRows);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      if (!token) {
        return;
      }

      try {
        const data = await getAgentDashboardData(token);

        if (ignore) {
          return;
        }

        const history = data.history || [];
        const lastWithIds = history.find((item) => item.zoho_id || item.dialer_id);
        if (lastWithIds) {
          setZohoId((current) => current || lastWithIds.zoho_id || "");
          setDialerId((current) => current || lastWithIds.dialer_id || "");
        }
        const normalizedRows = history.map((item) => ({
          refId: item.reference_id || `REF-${item.id}`,
          status: normalizeCallStatus(item.call_status),
          disposition: item.disposition || "NA",
          subDisposition: item.sub_disposition || "NA",
        }));

        setHistoryRecords(history);
        setRows(normalizedRows.length ? normalizedRows : fallbackRows);
        setSummary({
          totalCalls: data.summary?.totalCalls || history.length || 0,
          connectedCalls: history.filter((item) => normalizeCallStatus(item.call_status) === "Connected").length,
          notConnectedCalls: history.filter((item) => normalizeCallStatus(item.call_status) === "Not Connected").length,
          positiveCalls: history.filter((item) => item.disposition === "Positive").length,
        });
      } catch (_error) {
        if (!ignore) {
          setRows(fallbackRows);
          setHistoryRecords([]);
          setSummary(fallbackSummary);
        }
      }
    };

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [token]);

  const resetForm = () => {
    setReferenceId("");
    setCallStatus("Connected");
    setCallStatusOther("");
    setLanguage("NA");
    setLanguageOther("");
    setDisposition("Positive");
    setDispositionOther("");
    setSubDisposition("NA");
    setSubDispositionOther("");
    setNotes("");
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const effectiveCallStatus = showOtherCallStatus ? callStatusOther || "Other" : callStatus;
  const effectiveDisposition = showOtherDisposition ? dispositionOther || "Other" : disposition;
  const effectiveSubDisposition = showOtherSubDisposition ? subDispositionOther || "Other" : subDisposition;

  const handleSubmit = async () => {
    if (!token) {
      setFeedback("Login token missing. Please login first to connect dashboard with backend.");
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
          remark: notes,
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
      ]);
      setHistoryRecords((current) => [created, ...current]);

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
        positiveCalls: created.disposition === "Positive" ? current.positiveCalls + 1 : current.positiveCalls,
      }));

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

  return (
    <div style={shell}>
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
        `}
      </style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "364px minmax(0, 1fr)",
          minHeight: "100vh",
        }}
      >
        <aside
          style={{
            background: "linear-gradient(180deg, rgba(12,11,25,0.98) 0%, rgba(9,8,18,0.98) 100%)",
            borderRight: "1px solid rgba(114, 74, 246, 0.24)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "36px 34px 30px", borderBottom: "1px solid rgba(114, 74, 246, 0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
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
                }}
              >
                <div style={{ animation: "spinStar 10s linear infinite", display: "inline-flex" }}>
                  {aiStar}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 500 }}>CallCenter AI</div>
                <div style={{ marginTop: "6px", fontSize: "15px", color: "#a69ec3" }}>
                  Agent Portal v2.0
                </div>
              </div>
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
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "18px",
                  padding: "7px 14px",
                  borderRadius: "999px",
                  background: "rgba(122, 73, 255, 0.14)",
                  border: "1px solid rgba(166, 108, 255, 0.24)",
                  color: "#daafff",
                }}
              >
                <span
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "999px",
                    background: "#bf79ff",
                    animation: "pulseBadge 1.8s infinite",
                  }}
                />
                Online
              </div>
            </div>
          </div>

          <div style={{ padding: "18px 34px 10px", fontSize: "14px", color: "#726a91", letterSpacing: "0.06em" }}>
            NAVIGATION
          </div>

          <nav style={{ paddingTop: "6px" }}>
            {sidebarMenu.map((item) => (
              <div
                key={item.label}
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
            onClick={handleLogout}
            style={{ marginTop: "auto", padding: "28px 34px 30px", color: "#8b83aa", fontSize: "18px", cursor: "pointer" }}
            className="logout-btn"
          >
            Logout
          </div>
        </aside>

        <main style={{ padding: "34px 40px 34px" }}>
          {activeView === "history" ? (
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
                    All submitted call responses
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

              <div style={{ marginTop: "24px", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "1050px", borderCollapse: "collapse" }}>
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
                        "Remark",
                      ].map((heading) => (
                        <th key={heading} style={{ padding: "14px 12px", borderBottom: "1px solid rgba(114, 74, 246, 0.22)" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.length ? (
                      historyRecords.map((item) => {
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
                            <td style={{ padding: "16px 12px", color: "#c8c1df" }}>{item.remark || "-"}</td>
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
              Login time | {formatTime(loginTime)}
            </div>
          </div>

          <section
            style={{
              marginTop: "28px",
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "18px",
            }}
          >
            {[
              { title: "TODAY'S CALLS", value: summary.totalCalls, note: "6 from\nyesterday", accent: "#c387ff" },
              { title: "CONNECTED", value: summary.connectedCalls, note: "64.6% connect\nrate", accent: "#34d5ff" },
              { title: "NOT CONNECTED", value: summary.notConnectedCalls, note: "RNR / Switch off", accent: "#ff7a85" },
              { title: "POSITIVE", value: summary.positiveCalls, note: "10.4%\nconversion", accent: "#54ebb2" },
            ].map((item) => (
              <article style={{ ...panel, padding: "22px 24px" }} key={item.title}>
                <div style={{ fontSize: "16px", color: "#a9a1c3", lineHeight: 1.1, maxWidth: "120px" }}>
                  {item.title}
                </div>
                <div style={{ marginTop: "18px", fontSize: "52px", lineHeight: 1, color: item.accent }}>
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
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))", // Adjusted to 4 columns for dialer ID
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
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
                    setDisposition("Positive");
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

            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "16px", color: "#a7a0be", marginBottom: "10px" }}>REMARK</div>
              <textarea
                className="crm-textarea"
                style={{
                  ...fieldBase,
                  minHeight: "138px",
                  resize: "none",
                }}
                placeholder="Optional notes about the call..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

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
                onClick={resetForm}
                style={{
                  padding: "16px 28px",
                  borderRadius: "16px",
                  border: "1px solid rgba(158, 149, 184, 0.34)",
                  background: "transparent",
                  color: "#f5f1ff",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                Clear form
              </button>
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
    </div>
  );
};

export default Dashboard;
               
