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

      return matchesSearch && matchesStatus && matchesDisposition && matchesAgent;
    });
  }, [agentFilter, dispositionFilter, responses, search, statusFilter]);

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

  const dispositionBreakdown = useMemo(() => countBy(responses, "disposition"), [responses]);
  const subDispositionBreakdown = useMemo(() => countBy(responses, "sub_disposition"), [responses]);
  const languageBreakdown = useMemo(() => countBy(responses, "language"), [responses]);
  const topDisposition = dispositionBreakdown[0] || { label: "NA", value: 0 };
  const topLanguage = languageBreakdown[0] || { label: "NA", value: 0 };
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
