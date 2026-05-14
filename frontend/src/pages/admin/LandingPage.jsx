import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Dialflow.ai | Powered by Dhritii.ai";
  }, []);

  // State for live timers (Rahul, Priya, Sneha, Arjun)
  const [timers, setTimers] = useState([
    3 * 3600 + 24 * 60 + 15, // 03:24:15
    3 * 3600 + 18 * 60 + 42, // 03:18:42
    0 * 3600 + 8 * 60 + 33,  // 00:08:33
    2 * 3600 + 55 * 60 + 7,  // 02:55:07
  ]);
  const [rahulCalls, setRahulCalls] = useState(48);
  const [totalCallsLive, setTotalCallsLive] = useState(188);

  // Timer Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const next = [...prev];
        // All timers go up
        next[0]++; // Rahul Online
        next[1]++; // Priya Online
        next[2]++; // Sneha Break
        next[3]++; // Arjun Online
        
        // Occasionally bump call counts (every 2 minutes simulated)
        if (next[0] % 120 === 0) {
          setRahulCalls(c => c + 1);
          setTotalCallsLive(t => t + 1);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Intersection Observer for Scroll Animations
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  const heights = [35, 55, 80, 65, 45, 70, 90, 72, 60, 82];
  const colors = ['#7c3aed', '#a855f7', '#7c3aed', '#a855f7', '#6d28d9', '#a855f7', '#7c3aed', '#a855f7', '#6d28d9', '#a855f7'];

  return (
    <div style={{ background: '#05040f', color: '#f0eaff', fontFamily: "'DM Sans', sans-serif", fontSize: '16px', lineHeight: '1.6', overflowX: 'hidden', minHeight: '100vh', position: 'relative' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
          
          :root {
            --acc: #a855f7; --acc2: #7c3aed; --acc3: #c084fc;
            --cyan: #22d3ee; --green: #34d399; --txt: #f0eaff;
            --txt2: #9380b4; --txt3: #4a3d6e;
          }

          /* NOISE TEXTURE Layer */
          .noise-overlay {
            position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.4;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          }

          /* MESH BG */
          .mesh { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
          .mesh-blob { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.12; }
          .mesh-blob.b1 { width: 600px; height: 600px; background: #7c3aed; top: -100px; left: -100px; animation: drift1 18s infinite alternate ease-in-out; }
          .mesh-blob.b2 { width: 500px; height: 500px; background: #22d3ee; bottom: 0; right: -100px; animation: drift2 22s infinite alternate ease-in-out; }
          .mesh-blob.b3 { width: 400px; height: 400px; background: #a855f7; top: 40%; left: 40%; animation: drift3 15s infinite alternate ease-in-out; }
          @keyframes drift1 { from { transform: translate(0,0) scale(1); } to { transform: translate(80px,60px) scale(1.1); } }
          @keyframes drift2 { from { transform: translate(0,0) scale(1); } to { transform: translate(-60px,-80px) scale(1.15); } }
          @keyframes drift3 { from { transform: translate(0,0) scale(1); } to { transform: translate(-40px,50px) scale(0.9); } }

          .gradient-text { background: linear-gradient(135deg, #c084fc, #a855f7, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
          
          /* REVEAL Logic */
          .reveal { opacity: 0; transform: translateY(30px); transition: all 0.7s cubic-bezier(0.16,1,0.3,1); }
          .reveal.visible { opacity: 1; transform: translateY(0); }

          @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse2 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.3} }
          @keyframes timerTick { 0%,49%{opacity:1}50%,100%{opacity:0.6} }
          
          .online-dot { animation: blink 2s infinite; }
          .timer { animation: timerTick 1s infinite; font-variant-numeric: tabular-nums; }

          .divider-glow { height: 1px; background: linear-gradient(90deg, transparent, rgba(139,92,246,0.3), rgba(34,211,238,0.2), transparent); margin: 0 6%; }
          
          nav { background: rgba(5,4,15,0.7); backdrop-filter: blur(24px); border-bottom: 0.5px solid rgba(139,92,246,0.12); position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 6%; }
          
          .btn-primary { background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 0 20px rgba(168,85,247,0.35); }
          .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 30px rgba(168,85,247,0.5); }
          
          .feat-card { background: rgba(255,255,255,0.03); border: 0.5px solid rgba(139,92,246,0.2); border-radius: 20px; padding: 2rem; backdrop-filter: blur(20px); position: relative; overflow: hidden; transition: all 0.3s; }
          .feat-card:hover { transform: translateY(-6px); border-color: rgba(168,85,247,0.5); box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
          
          .step-num { width: 72px; height: 72px; border-radius: 50%; background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 800; color: #a855f7; position: relative; }
          .step-num::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 1px dashed rgba(168,85,247,0.2); animation: spin 12s linear infinite; }
        `}
      </style>

      <div className="noise-overlay" />
      <div className="mesh">
        <div className="mesh-blob b1" />
        <div className="mesh-blob b2" />
        <div className="mesh-blob b3" />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* NAVIGATION */}
        <nav>
          <div onClick={() => navigate("/")} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'Syne', fontWeight: 800, fontSize: '1.25rem', color: '#f0eaff', textDecoration: 'none', cursor: 'pointer' }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.96-1.87a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            Dialflow.ai
          </div>
          <ul style={{ display: 'flex', alignItems: 'center', gap: '2rem', listStyle: 'none' }}>
            {['Features', 'How it works', 'Monitoring'].map(l => (
              <li key={l}><a href={`#${l.toLowerCase().replace(/ /g,'')}`} style={{ color: '#9380b4', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>{l}</a></li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => navigate("/login")} style={{ padding: '8px 20px', border: '0.5px solid rgba(139,92,246,0.4)', background: 'transparent', color: '#c084fc', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Login</button>
            <button onClick={() => navigate("/register")} className="btn-primary" style={{ padding: '8px 22px', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Get Started
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
        </nav>

        {/* HERO SECTION */}
        <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6rem 6% 4rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(168,85,247,0.1)', border: '0.5px solid rgba(168,85,247,0.3)', borderRadius: '100px', padding: '6px 16px', fontSize: '0.8rem', fontWeight: 500, color: '#c084fc', marginBottom: '1.75rem', animation: 'fadeUp 0.8s ease both' }}>
            <div style={{ width: '6px', height: '6px', background: '#a855f7', borderRadius: '50%', animation: 'pulse2 2s infinite' }} />
            Now live — AI-powered call intelligence
          </div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 'clamp(2.8rem, 6vw, 5rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', maxWidth: '820px', animation: 'fadeUp 0.8s 0.1s ease both' }}>
            Smart Call Tracking.<br /><span className="gradient-text">Better Performance.</span>
          </h1>
          <p style={{ fontSize: '1.15rem', color: '#9380b4', maxWidth: '560px', margin: '1.5rem auto 2.5rem', fontWeight: 300, lineHeight: 1.7, animation: 'fadeUp 0.8s 0.2s ease both' }}>
            Dialflow.ai helps call center agents log responses faster and enables admins to track performance in real-time.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp 0.8s 0.3s ease both' }}>
            <button onClick={() => navigate("/register")} className="btn-primary" style={{ padding: '14px 32px', borderRadius: '12px', fontSize: '1rem', boxShadow: '0 0 40px rgba(168,85,247,0.4)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
               <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 8h8M8 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
               Get Started
            </button>
            <button onClick={() => navigate("/login")} style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(139,92,246,0.35)', color: '#fff', borderRadius: '12px', fontSize: '1rem', fontWeight: 500, cursor: 'pointer', backdropFilter: 'blur(10px)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
               <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z" stroke="currentColor" strokeWidth="1.4"/><path d="M6.5 6C6.5 5.17 7.17 4.5 8 4.5c.83 0 1.5.67 1.5 1.5 0 .83-.67 1.5-1.5 1.5v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="11" r="0.7" fill="currentColor"/></svg>
               Login
            </button>
          </div>

          {/* STATS */}
          <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', marginTop: '3.5rem', animation: 'fadeUp 0.8s 0.4s ease both', flexWrap: 'wrap' }}>
             {[ ['10x','Faster logging'], ['99.9%','Uptime SLA'], ['500+','Active agents'], ['Real‑time','Analytics'] ].map(s => (
               <div key={s[1]} style={{ textAlign: 'center' }}>
                  <div className="gradient-text" style={{ fontFamily: 'Syne', fontSize: '1.8rem', fontWeight: 800 }}>{s[0]}</div>
                  <div style={{ fontSize: '0.8rem', color: '#4a3d6e', marginTop: '2px' }}>{s[1]}</div>
               </div>
             ))}
          </div>

          {/* DASHBOARD PREVIEW */}
          <div style={{ marginTop: '4rem', width: '100%', maxWidth: '1000px', animation: 'fadeUp 0.8s 0.5s ease both', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: '-40px', background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(139,92,246,0.25)', borderRadius: '20px', padding: '20px', backdropFilter: 'blur(20px)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '0.5px solid rgba(139,92,246,0.15)' }}>
                 {['#ff5f57', '#febc2e', '#28c840'].map(c => <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />)}
                 <div style={{ fontSize: '11px', color: '#4a3d6e', marginLeft: '8px', fontFamily: 'Syne' }}>Dialflow.ai - Admin Dashboard</div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px', height: '320px', textAlign: 'left' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '12px', border: '0.5px solid rgba(139,92,246,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Syne', fontSize: '11px', fontWeight: 700, color: '#f0eaff', marginBottom: '12px', paddingBottom: '10px', borderBottom: '0.5px solid rgba(139,92,246,0.1)' }}>
                      <div style={{ width: '20px', height: '20px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', borderRadius: '5px' }} />
                      Dialflow.ai
                    </div>
                    {['Overview', 'Analytics', 'Responses', 'Agents', 'Reports', 'Export'].map((n, i) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', fontSize: '10px', color: i === 0 ? '#c084fc' : 'rgba(147,128,180,0.7)', background: i === 0 ? 'rgba(168,85,247,0.12)' : 'transparent' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} /> {n}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                       {[ ['342','Total Calls','#c084fc'], ['214','Connected','#22d3ee'], ['38','Positive','#34d399'], ['12','Agents Online','#fbbf24'] ].map(s => (
                         <div key={s[1]} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(139,92,246,0.15)', borderRadius: '8px', padding: '10px' }}>
                           <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'Syne', color: s[2] }}>{s[0]}</div>
                           <div style={{ fontSize: '8px', color: 'rgba(147,128,180,0.6)', marginTop: '2px' }}>{s[1]}</div>
                         </div>
                       ))}
                    </div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(139,92,246,0.1)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <div style={{ fontSize: '9px', color: 'rgba(147,128,180,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Call Volume · Today</div>
                       <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flex: 1, paddingTop: '8px' }}>
                          {heights.map((h, i) => <div key={i} style={{ height: `${h}%`, background: colors[i], flex: 1, borderRadius: '4px 4px 0 0', opacity: 0.7 }} />)}
                       </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                       {[ ['RS','Rahul S. — 48 calls','#7c3aed','#34d399'], ['PM','Priya M. — 44 calls','#0e7490','#34d399'], ['AK','Arjun K. — 38 calls','#065f46','#fbbf24'] ].map(a => (
                         <div key={a[0]} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '6px 8px', border: '0.5px solid rgba(139,92,246,0.08)' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600, color: '#fff', background: a[2] }}>{a[0]}</div>
                            <div style={{ fontSize: '9px', color: '#9380b4', flex: 1 }}>{a[1]}</div>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: a[3] }} />
                         </div>
                       ))}
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </section>

        <div className="divider-glow" />

        {/* FEATURES SECTION */}
        <section id="features" style={{ padding: '6rem 6%' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c084fc', marginBottom: '1rem' }}>Features</div>
            <h2 className="reveal" style={{ fontFamily: 'Syne', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1rem' }}>
              Everything your team needs.<br /><span className="gradient-text">Nothing they don't.</span>
            </h2>
            <p className="reveal" style={{ fontSize: '1rem', color: '#9380b4', maxWidth: '540px', margin: '0.75rem auto 0', fontWeight: 300 }}>Built specifically for call center workflows — fast, smart, and designed to reduce agent effort.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginTop: '3.5rem' }}>
             {[
               { title: 'Smart Call Logging', desc: 'Dynamic form with intelligent dropdown logic. Call Status → Disposition → Sub-Disposition.', tag: 'Dynamic dropdowns', icon: 'M8 10h8M8 14h5', color: '#a855f7' },
               { title: 'Intelligent Auto-Fill', desc: 'Zoho ID and Dialer ID auto-fill after first entry. Agent info is pulled from login session.', tag: 'Zero repeat entry', icon: 'M12 2L2 7l10 5 10-5-10-5z', color: '#22d3ee' },
               { title: 'Real-Time Tracking', desc: "Live Online / Break / Offline status for every agent. Working timers update in real-time.", tag: 'Live status', icon: 'M12 6v6l4 2', color: '#34d399' },
               { title: 'Admin Analytics', desc: "Performance tracking across all agents, filter by date/agent/disposition, and export with one click.", tag: 'Export ready', icon: 'M3 9h18M9 21V9', color: '#f59e0b' }
             ].map((f, i) => (
               <div key={f.title} className="feat-card reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                  <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', filter: 'blur(40px)', opacity: 0.15, background: f.color }} />
                  <div style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', background: `${f.color}1e`, border: `0.5px solid ${f.color}40` }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" style={{ width: '24px', height: '24px' }}>
                      {i === 0 ? <><rect x="3" y="3" width="18" height="18" rx="3"/><path d={f.icon}/></> : <path d={f.icon}/>}
                      {i === 2 && <circle cx="12" cy="12" r="10" />}
                    </svg>
                  </div>
                  <div style={{ fontFamily: 'Syne', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.6rem', color: '#f0eaff' }}>{f.title}</div>
                  <div style={{ fontSize: '0.9rem', color: '#9380b4', fontWeight: 300 }}>{f.desc}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '1.25rem', fontSize: '0.75rem', fontWeight: 500, padding: '4px 12px', borderRadius: '100px', background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '0.5px solid rgba(168,85,247,0.2)' }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> {f.tag}
                  </div>
               </div>
             ))}
          </div>
        </section>

        <div className="divider-glow" />

        {/* HOW IT WORKS SECTION */}
        <section id="howitworks" style={{ padding: '6rem 6%', background: 'linear-gradient(180deg, transparent, rgba(139,92,246,0.04) 50%, transparent)' }}>
           <div style={{ textAlign: 'center' }}>
             <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c084fc', marginBottom: '1rem' }}>Workflow</div>
             <h2 className="reveal" style={{ fontFamily: 'Syne', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1 }}>How Dialflow.ai works<br /><span className="gradient-text">in 4 simple steps.</span></h2>
           </div>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0', marginTop: '3.5rem', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '36px', left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.3), rgba(34,211,238,0.3), transparent)', zIndex: 0 }} />
              {[
                { n: '01', t: 'Agent Logs In', d: 'Secure login with username & password. Profile auto-loads — Emp ID, Zoho ID all pre-filled.' },
                { n: '02', t: 'Fills Call Response', d: 'Quick form — Ref ID, Call Status, Disposition with smart dropdowns.' },
                { n: '03', t: 'System Auto-Fills', d: 'Repeated data like Zoho ID is remembered. Backend stores everything instantly.' },
                { n: '04', t: 'Admin Monitors Live', d: 'Admin sees real-time data — call counts, agent status, and conversion rates.' }
              ].map((s, i) => (
                <div key={s.n} className="reveal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 1.5rem', position: 'relative', zIndex: 1, transitionDelay: `${i * 0.15}s` }}>
                   <div className="step-num" style={i === 1 ? {borderColor:'rgba(34,211,238,0.4)',color:'#22d3ee'} : i === 2 ? {borderColor:'rgba(52,211,153,0.4)',color:'#34d399'} : i === 3 ? {borderColor:'rgba(245,158,11,0.4)',color:'#f59e0b'} : {}}>
                     <span>{s.n}</span>
                   </div>
                   <div style={{ fontFamily: 'Syne', fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem', color: '#f0eaff' }}>{s.t}</div>
                   <div style={{ fontSize: '0.875rem', color: '#9380b4', fontWeight: 300 }}>{s.d}</div>
                </div>
              ))}
           </div>
        </section>

        <div className="divider-glow" />

        {/* MONITORING SECTION */}
        <section id="monitoring" style={{ padding: '6rem 6%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '4rem', alignItems: 'center' }}>
             <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c084fc', marginBottom: '1rem' }}>Real-Time Monitoring</div>
                <h2 className="reveal" style={{ fontFamily: 'Syne', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1 }}>Your team.<br /><span className="gradient-text">Live. Always.</span></h2>
                <p className="reveal" style={{ fontSize: '1rem', color: '#9380b4', fontWeight: 300 }}>Never lose visibility. Know exactly which agents are online, on break, or offline — and for how long.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '2rem' }}>
                   {[
                     { t: 'Live Working Timer', d: "Every agent's timer updates every second — see exactly how long they've been on shift.", c: '#34d399' },
                     { t: 'Online / Break / Offline Status', d: "Color-coded status indicators — green for online, yellow for break. Instant visibility.", c: '#a855f7' },
                     { t: 'Live Performance Feed', d: "Call counts update as agents submit. Admin sees tally without refreshing.", c: '#22d3ee' }
                   ].map((rt, i) => (
                     <div key={rt.t} className="reveal" style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(139,92,246,0.12)', borderRadius: '14px', transitionDelay: `${i * 0.1}s` }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${rt.c}1a`, border: `0.5px solid ${rt.c}33` }}>
                           <svg viewBox="0 0 18 18" fill="none" stroke={rt.c} strokeWidth="1.8" strokeLinecap="round" style={{ width: '18px' }}>
                             {i === 0 && <><circle cx="9" cy="9" r="7"/><path d="M9 5v4l2.5 2.5"/></>}
                             {i === 1 && <><circle cx="7" cy="5" r="3"/><path d="M1 15c0-3.314 2.686-6 6-6M13 10v5M10.5 12.5l2.5 2.5 2.5-2.5"/></>}
                             {i === 2 && <path d="M2 12 L5 8 L8 10 L11 5 L14 7"/>}
                           </svg>
                        </div>
                        <div>
                           <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f0eaff', marginBottom: '3px', fontFamily: 'Syne' }}>{rt.t}</div>
                           <div style={{ fontSize: '0.83rem', color: '#9380b4', fontWeight: 300 }}>{rt.d}</div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>

             <div className="reveal">
               <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: '20px', padding: '1.75rem', backdropFilter: 'blur(20px)', boxShadow: '0 40px 80px rgba(0,0,0,0.4)', textAlign: 'left' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4a3d6e', marginBottom: '1rem', paddingBottom: '10px', borderBottom: '0.5px solid rgba(139,92,246,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Agent Monitor
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 600, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '0.5px solid rgba(52,211,153,0.25)', padding: '2px 8px', borderRadius: '20px' }}>
                      <div className="online-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} /> Live
                    </div>
                  </div>

                  {[
                    { id: 'RS', n: 'Rahul Sharma', c: `${rahulCalls} calls today`, s: 'Online', t: formatTime(timers[0]), b: 'linear-gradient(135deg,#7c3aed,#a855f7)', st: 'online' },
                    { id: 'PM', n: 'Priya Mehta', c: '44 calls today', s: 'Online', t: formatTime(timers[1]), b: 'linear-gradient(135deg,#0e7490,#22d3ee)', st: 'online' },
                    { id: 'SR', n: 'Sneha Rao', c: '32 calls today', s: 'On break', t: formatTime(timers[2]), b: 'linear-gradient(135deg,#92400e,#fbbf24)', st: 'break' },
                    { id: 'AK', n: 'Arjun Kumar', c: '38 calls today', s: 'Online', t: formatTime(timers[3]), b: 'linear-gradient(135deg,#065f46,#34d399)', st: 'online' }
                  ].map(a => (
                    <div key={a.n} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '0.5px solid rgba(139,92,246,0.07)' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#fff', background: a.b }}>{a.id}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#f0eaff' }}>{a.n}</div>
                        <div style={{ fontSize: '11px', color: '#4a3d6e', marginTop: '1px' }}>{a.c}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', marginBottom: '3px', border: '0.5px solid', ...(a.st === 'online' ? {background:'rgba(52,211,153,0.1)',color:'#34d399',borderColor:'rgba(52,211,153,0.2)'} : {background:'rgba(251,191,36,0.1)',color:'#fbbf24',borderColor:'rgba(251,191,36,0.2)'}) }}>
                           <div className={a.st === 'online' ? 'online-dot' : ''} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} /> {a.s}
                        </div>
                        <div className="timer" style={{ fontSize: '11px', color: '#4a3d6e' }}>{a.t}</div>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '1rem' }}>
                     {[ ['3','Online now','#34d399'], ['1','On break','#fbbf24'], [totalCallsLive,'Total calls','#c084fc'], ['63.4%','Connect rate','#22d3ee'] ].map(m => (
                       <div key={m[1]} style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(139,92,246,0.12)', borderRadius: '12px', padding: '14px' }}>
                          <div style={{ fontFamily: 'Syne', fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px', color: m[2] }}>{m[0]}</div>
                          <div style={{ fontSize: '11px', color: '#4a3d6e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m[1]}</div>
                       </div>
                     ))}
                  </div>
               </div>
             </div>
          </div>
        </section>

        <div className="divider-glow" />

        {/* CTA SECTION */}
        <section style={{ padding: '5rem 6%', display: 'flex', justifyContent: 'center' }}>
           <div className="reveal" style={{ maxWidth: '900px', width: '100%', background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))', border: '0.5px solid rgba(168,85,247,0.3)', borderRadius: '28px', padding: '4rem', textAlign: 'center', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(20px)' }}>
              <div style={{ position: 'absolute', top: '-100px', left: '-100px', right: '-100px', bottom: '-100px', background: 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
              <h2 style={{ fontFamily: 'Syne', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '1rem' }}>
                Ready to transform your<br /><span className="gradient-text">call center operations?</span>
              </h2>
              <p style={{ fontSize: '1.05rem', color: '#9380b4', marginBottom: '2.5rem', fontWeight: 300 }}>Join hundreds of agents already using Dialflow.ai to log smarter and perform better.</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                 <button onClick={() => navigate("/register")} className="btn-primary" style={{ padding: '14px 32px', borderRadius: '12px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 8h8M8 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
                   Get Started Free
                 </button>
              </div>
           </div>
        </section>

        {/* FOOTER */}
        <footer style={{ padding: '2.5rem 6%', borderTop: '0.5px solid rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
           <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Syne', fontWeight: 700, fontSize: '1rem', color: '#f0eaff', textDecoration: 'none' }}>
              <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.96-1.87a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              Dialflow.ai
           </a>
           <div style={{ fontSize: '0.8rem', color: '#4a3d6e' }}>© 2026 Dialflow.ai &nbsp;·&nbsp; Powered by <a href="http://Dhritii.ai" target="_blank" rel="noreferrer" style={{ color: '#c084fc', textDecoration: 'none' }}>Dhritii.ai</a></div>
           <div style={{ display: 'flex', gap: '1.5rem' }}>
              {['Privacy', 'Terms', 'Support'].map(l => <a key={l} href="#" style={{ fontSize: '0.8rem', color: '#4a3d6e', textDecoration: 'none' }}>{l}</a>)}
           </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
