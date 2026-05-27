import React, { useEffect, useMemo, useState } from "react";

import { getAdminLeaderboard } from "../../services/rankingService";

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

const button = {
  padding: "13px 18px",
  borderRadius: "12px",
  border: "1px solid rgba(154, 145, 176, 0.44)",
  background: "transparent",
  color: "#f4f0ff",
  cursor: "pointer",
  fontSize: "15px",
  fontWeight: 600,
};

const periods = [
  ["today", "Today"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
];

const podiumStyles = [
  { label: "Gold", color: "#ffd166", bg: "rgba(255, 209, 102, 0.12)", border: "rgba(255, 209, 102, 0.45)" },
  { label: "Silver", color: "#d7deea", bg: "rgba(215, 222, 234, 0.1)", border: "rgba(215, 222, 234, 0.34)" },
  { label: "Bronze", color: "#f4a261", bg: "rgba(244, 162, 97, 0.12)", border: "rgba(244, 162, 97, 0.36)" },
];

const statusTone = (status) => {
  if (status === "online") return { color: "#35e5a7", bg: "rgba(53, 229, 167, 0.13)", border: "rgba(53, 229, 167, 0.34)" };
  if (status === "break") return { color: "#ffa500", bg: "rgba(255, 165, 0, 0.13)", border: "rgba(255, 165, 0, 0.34)" };
  return { color: "#ff7685", bg: "rgba(255, 118, 133, 0.13)", border: "rgba(255, 118, 133, 0.34)" };
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportRows = (rows, period, format) => {
  const headers = ["Rank", "Agent", "Score", "Positive", "Connected", "Total Calls", "Conversion %", "Status"];
  const dataRows = rows.map((row) => [
    row.rank,
    row.agent_name,
    row.ranking_score,
    row.positive_calls,
    row.connected_calls,
    row.total_calls,
    row.conversion_rate,
    row.current_status,
  ]);

  if (format === "excel") {
    const tableRows = [headers, ...dataRows]
      .map((cells) => `<tr>${cells.map((cell) => `<td>${String(cell ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`)
      .join("");
    downloadFile(`<table>${tableRows}</table>`, `agent-ranking-${period}.xls`, "application/vnd.ms-excel");
    return;
  }

  downloadFile(
    [headers, ...dataRows].map((row) => row.map(csvEscape).join(",")).join("\n"),
    `agent-ranking-${period}.csv`,
    "text/csv;charset=utf-8"
  );
};

const insightValue = (row, key) => (row ? row[key] : 0);

const AdminRanking = ({ token }) => {
  const [period, setPeriod] = useState("today");
  const [search, setSearch] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadRanking = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const data = await getAdminLeaderboard(token, { period, search });
        if (!ignore) {
          setLeaderboard(data.leaderboard || []);
          setFeedback("");
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(error.message || "Unable to load ranking.");
          setLeaderboard([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadRanking();
    return () => {
      ignore = true;
    };
  }, [period, search, token]);

  const topThree = leaderboard.slice(0, 3);
  const insights = useMemo(() => {
    const bestPerformer = leaderboard[0] || null;
    const mostActive = leaderboard.reduce((best, row) => (row.total_calls > insightValue(best, "total_calls") ? row : best), null);
    const bestConversion = leaderboard.reduce((best, row) => (row.conversion_rate > insightValue(best, "conversion_rate") ? row : best), null);
    const bestConnector = leaderboard.reduce((best, row) => (row.connected_calls > insightValue(best, "connected_calls") ? row : best), null);

    return [
      ["Best Performer", bestPerformer?.agent_name || "NA", bestPerformer ? `${bestPerformer.ranking_score} score` : "No data", "#ffd166"],
      ["Most Active", mostActive?.agent_name || "NA", mostActive ? `${mostActive.total_calls} calls` : "No data", "#c387ff"],
      ["Best Conversion", bestConversion?.agent_name || "NA", bestConversion ? `${bestConversion.conversion_rate}%` : "No data", "#54ebb2"],
      ["Best Connector", bestConnector?.agent_name || "NA", bestConnector ? `${bestConnector.connected_calls} connected` : "No data", "#34d5ff"],
    ];
  }, [leaderboard]);

  return (
    <>
      <style>
        {`
          .ranking-filter-grid { display: grid; grid-template-columns: 360px minmax(220px, 1fr) auto auto; gap: 14px; align-items: center; }
          .ranking-podium-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
          .ranking-insight-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
          .ranking-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          @media (max-width: 1100px) {
            .ranking-filter-grid, .ranking-podium-grid, .ranking-insight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 680px) {
            .ranking-filter-grid, .ranking-podium-grid, .ranking-insight-grid { grid-template-columns: 1fr; }
          }
        `}
      </style>

      <div className="admin-toolbar" style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>Agent Ranking</h1>
          <div style={{ marginTop: "8px", color: "#9da6c3", fontSize: "16px" }}>
            Score = positive x 5 + connected x 3 + total calls x 2
          </div>
        </div>
      </div>

      <section className="ranking-filter-grid" style={{ marginTop: "26px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {periods.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriod(id)}
              style={{
                ...button,
                background: period === id ? "rgba(122, 73, 255, 0.2)" : "transparent",
                borderColor: period === id ? "rgba(168, 85, 247, 0.62)" : "rgba(154, 145, 176, 0.44)",
                color: period === id ? "#d9b7ff" : "#f4f0ff",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input style={input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agent or employee ID" />
        <button type="button" onClick={() => exportRows(leaderboard, period, "csv")} style={button}>CSV</button>
        <button type="button" onClick={() => exportRows(leaderboard, period, "excel")} style={button}>Excel</button>
      </section>

      {feedback ? <div style={{ marginTop: "16px", color: "#ff9aa7" }}>{feedback}</div> : null}

      <section className="ranking-podium-grid" style={{ marginTop: "28px" }}>
        {topThree.map((agent, index) => {
          const tone = podiumStyles[index];
          return (
            <article key={agent.agent_id} style={{ ...panel, padding: "24px", background: tone.bg, borderColor: tone.border, minHeight: "210px" }}>
              <div style={{ color: tone.color, fontSize: "14px", fontWeight: 700 }}>{tone.label} | Rank {agent.rank}</div>
              <div style={{ marginTop: "14px", fontSize: "24px", fontWeight: 700 }}>{agent.agent_name}</div>
              <div style={{ marginTop: "12px", color: tone.color, fontSize: "38px", lineHeight: 1 }}>{agent.ranking_score}</div>
              <div style={{ marginTop: "18px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", color: "#d8d1ee" }}>
                <span>Positive {agent.positive_calls}</span>
                <span>Connected {agent.connected_calls}</span>
                <span>Total {agent.total_calls}</span>
                <span>{agent.conversion_rate}%</span>
              </div>
            </article>
          );
        })}
        {!topThree.length && !loading ? <div style={{ ...panel, padding: "24px", color: "#9da6c3" }}>No ranking data yet.</div> : null}
      </section>

      <section className="ranking-insight-grid" style={{ marginTop: "18px" }}>
        {insights.map(([label, value, note, accent]) => (
          <article key={label} style={{ ...panel, padding: "20px", borderTop: `3px solid ${accent}` }}>
            <div style={{ color: "#8f98b7", fontSize: "14px" }}>{label}</div>
            <div style={{ marginTop: "10px", fontSize: "21px", fontWeight: 700 }}>{value}</div>
            <div style={{ marginTop: "8px", color: accent }}>{note}</div>
          </article>
        ))}
      </section>

      <section style={{ ...panel, marginTop: "24px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>Leaderboard</h2>
          <span style={{ color: "#9da6c3" }}>{loading ? "Loading..." : `${leaderboard.length} agents`}</span>
        </div>
        <div className="ranking-table-wrap" style={{ marginTop: "18px" }}>
          <table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#7f87a6", textAlign: "left", fontSize: "13px" }}>
                {["Rank", "Agent", "Score", "Positive", "Connected", "Total Calls", "Conversion %", "Status"].map((heading) => (
                  <th key={heading} style={{ padding: "13px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((agent) => {
                const tone = statusTone(agent.current_status);
                return (
                  <tr key={agent.agent_id} style={{ borderBottom: "1px solid rgba(122, 73, 255, 0.14)" }}>
                    <td style={{ padding: "15px 12px", color: "#d9b7ff", fontWeight: 700 }}>#{agent.rank}</td>
                    <td style={{ padding: "15px 12px" }}>{agent.agent_name}</td>
                    <td style={{ padding: "15px 12px", color: "#ffd166", fontWeight: 700 }}>{agent.ranking_score}</td>
                    <td style={{ padding: "15px 12px" }}>{agent.positive_calls}</td>
                    <td style={{ padding: "15px 12px" }}>{agent.connected_calls}</td>
                    <td style={{ padding: "15px 12px" }}>{agent.total_calls}</td>
                    <td style={{ padding: "15px 12px" }}>{agent.conversion_rate}%</td>
                    <td style={{ padding: "15px 12px" }}>
                      <span style={{ display: "inline-flex", padding: "6px 12px", borderRadius: "999px", color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}>
                        {agent.current_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

export default AdminRanking;
