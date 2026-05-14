import React, { useEffect, useMemo, useState } from "react";

import { getAgentRanking } from "../../services/rankingService";

const panel = {
  background: "rgba(18, 17, 37, 0.96)",
  border: "1px solid rgba(122, 73, 255, 0.32)",
  borderRadius: "18px",
  boxSizing: "border-box",
};

const periods = [
  ["today", "Today"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
];

const avatarColors = ["#7c3aed", "#0e8aa8", "#6d2b86", "#087a62", "#b45309", "#1f4f7a"];

const toInitials = (name = "Agent") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "AG";

const firstName = (name = "Agent") => name.split(" ")[0] || name;

const formatPeriodDate = () =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

const periodLabel = (period) => {
  if (period === "weekly") return "This Week";
  if (period === "monthly") return "This Month";
  return `Today | ${formatPeriodDate()}`;
};

const AgentAvatar = ({ agent, size = 42, index = 0, ring = false }) => (
  <div
    style={{
      width: size,
      height: size,
      minWidth: size,
      borderRadius: "999px",
      display: "grid",
      placeItems: "center",
      background: avatarColors[index % avatarColors.length],
      color: "#ffffff",
      fontWeight: 800,
      fontSize: Math.max(12, size * 0.3),
      border: ring ? "3px solid #ffd02d" : "1px solid rgba(255,255,255,0.1)",
      boxShadow: ring ? "0 0 0 5px rgba(255, 208, 45, 0.13)" : "none",
    }}
  >
    {toInitials(agent?.agent_name)}
  </div>
);

const StatPill = ({ value, color }) => (
  <span
    style={{
      display: "inline-flex",
      minWidth: "30px",
      justifyContent: "center",
      padding: "4px 9px",
      borderRadius: "999px",
      color,
      background: `${color}18`,
      border: `1px solid ${color}45`,
      fontWeight: 700,
      fontSize: "13px",
    }}
  >
    {value}
  </span>
);

const PodiumSlot = ({ agent, order, index }) => {
  const config = {
    1: { height: 132, color: "#ffd02d", border: "rgba(255, 208, 45, 0.72)", rankLabel: "#1" },
    2: { height: 102, color: "#aeb7cd", border: "rgba(174, 183, 205, 0.42)", rankLabel: "#2" },
    3: { height: 72, color: "#ff8a2a", border: "rgba(255, 138, 42, 0.52)", rankLabel: "#3" },
  }[order];

  if (!agent) {
    return <div />;
  }

  return (
    <div className="podium-slot" style={{ alignSelf: "end", display: "grid", justifyItems: "center", minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        {order === 1 ? (
          <div style={{ position: "absolute", top: "-20px", left: "50%", transform: "translateX(-50%)", color: "#ffd02d", fontSize: "21px", fontWeight: 900 }}>
            MVP
          </div>
        ) : null}
        <AgentAvatar agent={agent} size={order === 1 ? 72 : 64} index={index} ring={order === 1} />
      </div>
      <div style={{ marginTop: "12px", textAlign: "center", maxWidth: "130px" }}>
        <div style={{ color: "#f4f0ff", fontWeight: 800, fontSize: "17px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {firstName(agent.agent_name)} {agent.agent_name.split(" ")[1]?.[0] ? `${agent.agent_name.split(" ")[1][0]}.` : ""}
        </div>
        <div style={{ marginTop: "4px", color: "#8b86a8", fontSize: "13px" }}>{agent.ranking_score} pts</div>
      </div>
      <div
        style={{
          marginTop: "10px",
          width: "100%",
          maxWidth: order === 1 ? "132px" : "122px",
          height: config.height,
          borderRadius: "10px 10px 0 0",
          display: "grid",
          placeItems: "center",
          color: config.color,
          fontSize: "28px",
          fontWeight: 900,
          background: `linear-gradient(180deg, ${config.color}30, rgba(20, 18, 34, 0.72))`,
          border: `1px solid ${config.border}`,
          borderBottomColor: config.color,
        }}
      >
        {config.rankLabel}
      </div>
    </div>
  );
};

const AgentRanking = ({ token, employeeId }) => {
  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState({
    current_rank: null,
    ranking_score: 0,
    next_rank_score_gap: 0,
    top_3_agents: [],
    top_10_agents: [],
    current_agent: null,
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadRanking = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const data = await getAgentRanking(token, { period });
        if (!ignore) {
          setRanking({
            current_rank: data.current_rank,
            ranking_score: data.ranking_score || 0,
            next_rank_score_gap: data.next_rank_score_gap || 0,
            top_3_agents: data.top_3_agents || [],
            top_10_agents: data.top_10_agents || [],
            current_agent: data.current_agent || null,
          });
          setFeedback("");
        }
      } catch (error) {
        if (!ignore) {
          setFeedback(error.message || "Unable to load ranking.");
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
  }, [period, token]);

  const displayedLeaderboard = useMemo(() => {
    if (
      ranking.current_agent &&
      !ranking.top_10_agents.some((agent) => agent.employee_id === ranking.current_agent.employee_id)
    ) {
      return [...ranking.top_10_agents, ranking.current_agent];
    }

    return ranking.top_10_agents;
  }, [ranking.current_agent, ranking.top_10_agents]);

  const podiumByPlace = [
    ranking.top_3_agents[1],
    ranking.top_3_agents[0],
    ranking.top_3_agents[2],
  ];
  const currentAgent = ranking.current_agent || {};
  const maxScore = Math.max(...displayedLeaderboard.map((agent) => agent.ranking_score || 0), 1);

  return (
    <>
      <style>
        {`
          .agent-ranking-header {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .agent-ranking-periods {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .agent-ranking-hero {
            display: grid;
            grid-template-columns: 1.2fr repeat(4, minmax(90px, 1fr));
            gap: 22px;
            align-items: center;
          }

          .agent-ranking-feature-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.8fr);
            gap: 18px;
          }

          .agent-podium-stage {
            display: grid;
            grid-template-columns: repeat(3, minmax(92px, 1fr));
            align-items: end;
            gap: 14px;
            min-height: 430px;
          }

          .agent-ranking-table {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .leaderboard-row {
            transition: background 140ms ease, transform 140ms ease;
          }

          .leaderboard-row:hover {
            background: rgba(122, 73, 255, 0.1) !important;
          }

          @media (max-width: 1180px) {
            .agent-ranking-hero {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .agent-ranking-feature-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 720px) {
            .agent-ranking-hero {
              grid-template-columns: 1fr;
            }

            .agent-podium-stage {
              min-height: auto;
              grid-template-columns: 1fr;
            }

            .podium-slot {
              max-width: 220px;
              width: 100%;
              justify-self: center;
            }
          }
        `}
      </style>

      <div className="agent-ranking-header">
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>My Ranking</h1>
          <div style={{ marginTop: "8px", color: "#aeb5d4", fontSize: "16px" }}>
            Today's performance score based on calls
          </div>
        </div>
        <div style={{ display: "grid", gap: "10px", justifyItems: "end" }}>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              color: "#d39cff",
              background: "rgba(122, 73, 255, 0.15)",
              border: "1px solid rgba(197, 110, 255, 0.44)",
              fontWeight: 700,
            }}
          >
            {periodLabel(period)}
          </div>
          <div className="agent-ranking-periods">
            {periods.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                style={{
                  padding: "8px 13px",
                  borderRadius: "999px",
                  border: `1px solid ${period === id ? "rgba(197, 110, 255, 0.62)" : "rgba(122, 73, 255, 0.28)"}`,
                  background: period === id ? "rgba(122, 73, 255, 0.26)" : "rgba(18, 17, 37, 0.68)",
                  color: period === id ? "#e2bdff" : "#aeb5d4",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feedback ? <div style={{ marginTop: "16px", color: "#ff9aa7" }}>{feedback}</div> : null}

      <section
        style={{
          ...panel,
          marginTop: "28px",
          padding: "28px",
          background: "linear-gradient(180deg, rgba(57, 24, 95, 0.76), rgba(29, 18, 53, 0.96))",
          borderColor: "rgba(174, 93, 255, 0.58)",
          boxShadow: "0 26px 70px rgba(0, 0, 0, 0.22)",
        }}
      >
        <div className="agent-ranking-hero">
          <div style={{ display: "flex", alignItems: "center", gap: "22px", minWidth: 0 }}>
            <div>
              <div style={{ color: "#c681ff", fontSize: "72px", lineHeight: 0.92, fontWeight: 900 }}>
                {ranking.current_rank ? `#${ranking.current_rank}` : "NA"}
              </div>
              <div style={{ marginTop: "8px", color: "#7f789c", letterSpacing: "0.08em", fontSize: "13px", textTransform: "uppercase" }}>
                Your Rank
              </div>
              <div
                style={{
                  marginTop: "12px",
                  display: "inline-flex",
                  padding: "7px 15px",
                  borderRadius: "999px",
                  color: "#d8abff",
                  background: "rgba(122, 73, 255, 0.22)",
                  border: "1px solid rgba(197, 110, 255, 0.42)",
                  fontWeight: 700,
                }}
              >
                {ranking.ranking_score} pts
              </div>
            </div>
            <div style={{ width: 1, height: 86, background: "rgba(197, 110, 255, 0.22)" }} />
          </div>

          {[
            ["Positive", currentAgent.positive_calls || 0, "#35e5a7"],
            ["Connected", currentAgent.connected_calls || 0, "#27d8ff"],
            ["Total Calls", currentAgent.total_calls || 0, "#c681ff"],
            ["Score", ranking.ranking_score, "#ffd02d"],
          ].map(([label, value, accent]) => (
            <div key={label} style={{ textAlign: "center", minWidth: 0 }}>
              <div style={{ color: accent, fontSize: "26px", fontWeight: 800 }}>{value}</div>
              <div style={{ marginTop: "8px", color: "#7f789c", fontSize: "12px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="agent-ranking-feature-grid" style={{ marginTop: "26px" }}>
        <article style={{ ...panel, padding: "26px 28px", minHeight: "520px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px" }}>
            <h2 style={{ margin: 0, fontSize: "21px", fontWeight: 700 }}>
              <span style={{ color: "#ffd02d", marginRight: "10px" }}>*</span>
              Top 3 Podium
            </h2>
            <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#d39cff", border: "1px solid rgba(197, 110, 255, 0.42)", background: "rgba(122, 73, 255, 0.14)" }}>
              {period === "today" ? "Today" : period === "weekly" ? "Weekly" : "Monthly"}
            </span>
          </div>
          <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.22)" }} />
          {ranking.top_3_agents.length ? (
            <div className="agent-podium-stage">
              <PodiumSlot agent={podiumByPlace[0]} order={2} index={1} />
              <PodiumSlot agent={podiumByPlace[1]} order={1} index={0} />
              <PodiumSlot agent={podiumByPlace[2]} order={3} index={2} />
            </div>
          ) : (
            <div style={{ minHeight: "340px", display: "grid", placeItems: "center", color: "#8b86a8" }}>
              No podium data yet.
            </div>
          )}
        </article>

        <article style={{ ...panel, padding: "26px 28px", minHeight: "520px", overflow: "hidden" }}>
          <h2 style={{ margin: 0, fontSize: "21px", fontWeight: 700 }}>
            <span style={{ color: "#27d8ff", marginRight: "10px" }}>~</span>
            Top 10 Agents
          </h2>
          <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.22)" }} />
          <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
            {ranking.top_10_agents.map((agent, index) => {
              const isOwnRow = agent.employee_id === employeeId;
              return (
                <div
                  key={agent.agent_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "34px 42px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    background: isOwnRow ? "rgba(122, 73, 255, 0.2)" : "transparent",
                    border: isOwnRow ? "1px solid rgba(197, 110, 255, 0.36)" : "1px solid transparent",
                  }}
                >
                  <div style={{ color: index < 3 ? "#ffd02d" : "#68617f", fontWeight: 900 }}>#{agent.rank}</div>
                  <AgentAvatar agent={agent} index={index} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#f4f0ff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {agent.agent_name}{isOwnRow ? " (You)" : ""}
                    </div>
                    <div style={{ marginTop: "3px", color: "#716b88", fontSize: "12px" }}>{agent.employee_id}</div>
                  </div>
                  <div style={{ color: "#d39cff", fontWeight: 800 }}>{agent.ranking_score}</div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section style={{ ...panel, marginTop: "26px", padding: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "21px", fontWeight: 700 }}>
            <span style={{ color: "#c681ff", marginRight: "10px" }}>[]</span>
            Full Leaderboard
          </h2>
          <span style={{ padding: "7px 16px", borderRadius: "999px", color: "#d39cff", border: "1px solid rgba(197, 110, 255, 0.42)", background: "rgba(122, 73, 255, 0.14)" }}>
            {loading ? "Loading..." : `${displayedLeaderboard.length} agents | ${period === "today" ? "Today" : period}`}
          </span>
        </div>
        <div style={{ marginTop: "20px", borderTop: "1px solid rgba(122, 73, 255, 0.22)" }} />

        <div className="agent-ranking-table" style={{ marginTop: "18px" }}>
          <table style={{ width: "100%", minWidth: "880px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#6f6888", textAlign: "left", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {["Rank", "Agent", "Positive", "Connected", "Total", "Score", "Bar"].map((heading) => (
                  <th key={heading} style={{ padding: "14px 12px", borderBottom: "1px solid rgba(122, 73, 255, 0.24)" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedLeaderboard.map((agent, index) => {
                const isOwnRow = agent.employee_id === employeeId;
                const barWidth = Math.max((agent.ranking_score / maxScore) * 100, agent.ranking_score ? 10 : 0);

                return (
                  <tr
                    key={agent.agent_id}
                    className="leaderboard-row"
                    style={{
                      background: isOwnRow ? "rgba(122, 73, 255, 0.2)" : "transparent",
                      borderBottom: "1px solid rgba(122, 73, 255, 0.14)",
                    }}
                  >
                    <td style={{ padding: "14px 12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          width: "34px",
                          height: "34px",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "9px",
                          color: index < 3 ? "#ffd02d" : "#8c86a4",
                          border: `1px solid ${index < 3 ? "rgba(255, 208, 45, 0.38)" : "rgba(122, 73, 255, 0.32)"}`,
                          background: index < 3 ? "rgba(255, 208, 45, 0.09)" : "rgba(122, 73, 255, 0.12)",
                          fontWeight: 800,
                        }}
                      >
                        {agent.rank}
                      </span>
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                        <AgentAvatar agent={agent} index={index} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "#f4f0ff", fontWeight: 800 }}>
                            {agent.agent_name} {isOwnRow ? <span style={{ color: "#d39cff", fontSize: "12px", border: "1px solid rgba(197,110,255,0.42)", borderRadius: "999px", padding: "2px 7px" }}>You</span> : null}
                          </div>
                          <div style={{ marginTop: "4px", color: "#716b88", fontSize: "12px" }}>{agent.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 12px" }}><StatPill value={agent.positive_calls} color="#35e5a7" /></td>
                    <td style={{ padding: "14px 12px" }}><StatPill value={agent.connected_calls} color="#27d8ff" /></td>
                    <td style={{ padding: "14px 12px" }}><StatPill value={agent.total_calls} color="#c681ff" /></td>
                    <td style={{ padding: "14px 12px", color: "#d39cff", fontWeight: 900 }}>{agent.ranking_score}</td>
                    <td style={{ padding: "14px 12px", width: "150px" }}>
                      <div style={{ height: "7px", borderRadius: "999px", background: "rgba(122, 73, 255, 0.16)", overflow: "hidden" }}>
                        <div style={{ width: `${barWidth}%`, height: "100%", borderRadius: "999px", background: "linear-gradient(90deg, #7c3aed, #c56eff)" }} />
                      </div>
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

export default AgentRanking;
