import { useState, useEffect, useRef } from "react";
import { Shield, Eye, BarChart3, FileText, Bot, ChevronRight, Globe, Zap, Lock, Bell, TrendingUp, Users, CheckCircle, ArrowRight, Menu, X } from "lucide-react";

const GOLD = "#C8943E";
const GOLD_L = "#E8C47A";
const DEEP = "#0B1120";
const CREAM = "#F5F0E6";
const TEAL = "#0D7377";
const CORAL = "#C75C3A";

function GeometricPattern({ opacity = 0.06, color = GOLD }) {
  const circles = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 12; col++) {
      const cx = col * 52 + (row % 2 ? 26 : 0);
      const cy = row * 52;
      circles.push(<circle key={`${row}-${col}`} cx={cx} cy={cy} r={20} fill="none" stroke={color} strokeWidth="0.5" opacity={opacity} />);
    }
  }
  return <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none" }} viewBox="0 0 620 420" preserveAspectRatio="xMidYMid slice">{circles}</svg>;
}

function ShieldLogo({ size = 48, dark = false }) {
  const bg = dark ? DEEP : "transparent";
  const stroke = dark ? GOLD : DEEP;
  const fill = dark ? GOLD : DEEP;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="12" y="6" width="24" height="36" rx="6" stroke={stroke} strokeWidth="2" fill={bg} />
      <circle cx="24" cy="24" r="7" fill={fill} />
      <circle cx="24" cy="24" r="3.5" fill={dark ? DEEP : CREAM} />
      <circle cx="24" cy="23" r="1.5" fill={dark ? GOLD_L : DEEP} />
    </svg>
  );
}

function AnimatedCounter({ end, suffix = "", prefix = "", duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * end));
          if (progress < 1) requestAnimationFrame(tick);
        };
        tick();
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString("id-ID")}{suffix}</span>;
}

export default function RaqibLanding() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activePlan, setActivePlan] = useState("pro");

  return (
    <div style={{ fontFamily: "'Crimson Pro', 'Georgia', serif", color: DEEP, background: CREAM, overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Big+Shoulders+Display:wght@700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(200,148,62,0.3); } 50% { box-shadow: 0 0 20px 4px rgba(200,148,62,0.15); } }
        .fade-up { animation: fadeUp 0.8s ease-out both; }
        .fade-up-d1 { animation-delay: 0.1s; }
        .fade-up-d2 { animation-delay: 0.2s; }
        .fade-up-d3 { animation-delay: 0.3s; }
        .fade-up-d4 { animation-delay: 0.4s; }
        .btn-gold { background: linear-gradient(135deg, ${GOLD}, #A67A2E); color: #fff; border: none; padding: 14px 32px; border-radius: 8px; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
        .btn-gold:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(200,148,62,0.3); }
        .btn-outline { background: transparent; color: ${DEEP}; border: 1.5px solid ${GOLD}; padding: 13px 32px; border-radius: 8px; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-outline:hover { background: ${GOLD}; color: #fff; }
      `}</style>

      {/* ─── NAVBAR ─────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(245,240,230,0.85)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid rgba(200,148,62,0.15)`,
        padding: "0 32px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldLogo size={32} />
            <span style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "0.04em", color: DEEP }}>RAQIB</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {["Features", "Agents", "Pricing", "Docs"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} style={{ color: "#2D3748", textDecoration: "none", fontSize: 14, fontWeight: 400, fontFamily: "'Crimson Pro', serif" }}>{item}</a>
            ))}
            <button className="btn-gold" style={{ padding: "8px 20px", fontSize: 13 }}>
              Get started <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ──────────────────────────────── */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", background: DEEP, overflow: "hidden",
        paddingTop: 64,
      }}>
        <GeometricPattern opacity={0.05} />
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 800, padding: "0 24px" }}>
          <div className="fade-up" style={{
            fontFamily: "'Noto Naskh Arabic', serif", fontSize: 48, color: GOLD,
            marginBottom: 16, direction: "rtl",
          }}>رقيب</div>
          <h1 className="fade-up fade-up-d1" style={{
            fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 64,
            fontWeight: 800, color: "#FAFAF7", lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}>
            The Watchful Guardian<br />of Compliance
          </h1>
          <p className="fade-up fade-up-d2" style={{
            fontSize: 19, color: GOLD_L, maxWidth: 560, margin: "24px auto 0",
            lineHeight: 1.7, fontStyle: "italic",
          }}>
            12 AI agents. Zero blind spots. The only GRC platform with
            Sharia compliance built into its DNA.
          </p>
          <div className="fade-up fade-up-d3" style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 40 }}>
            <button className="btn-gold" style={{ fontSize: 16, padding: "16px 36px" }}>
              Start free <ArrowRight size={16} />
            </button>
            <button className="btn-outline" style={{ color: GOLD_L, borderColor: "rgba(232,196,122,0.3)" }}>
              Watch demo
            </button>
          </div>
          <div className="fade-up fade-up-d4" style={{
            display: "flex", gap: 40, justifyContent: "center", marginTop: 48,
            fontSize: 13, color: "#64748B",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span>POJK · DSN-MUI · ISO 37001</span>
            <span>Hermes Agent powered</span>
            <span>SOC 2 ready</span>
          </div>
        </div>

        {/* Decorative shield glow */}
        <div style={{
          position: "absolute", bottom: -120, left: "50%", transform: "translateX(-50%)",
          width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(200,148,62,0.08) 0%, transparent 70%)`,
        }} />
      </section>

      {/* ─── STATS BAR ─────────────────────────── */}
      <section style={{ background: "#fff", borderBottom: `1px solid rgba(200,148,62,0.1)`, padding: "48px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32, textAlign: "center" }}>
          {[
            { val: 12, suffix: "", label: "AI agents" },
            { val: 26, suffix: "+", label: "Regulatory sources" },
            { val: 99, suffix: ".7%", label: "Uptime SLA" },
            { val: 15000, suffix: "+", label: "Target auditors in Indonesia" },
          ].map((stat, i) => (
            <div key={i}>
              <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 40, fontWeight: 800, color: GOLD }}>
                <AnimatedCounter end={stat.val} suffix={stat.suffix} />
              </div>
              <div style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ──────────────────────────── */}
      <section id="features" style={{ padding: "96px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: GOLD, letterSpacing: "0.15em", marginBottom: 12 }}>FEATURES</div>
          <h2 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 40, fontWeight: 800, color: DEEP }}>
            Every compliance angle, covered.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { icon: Shield, title: "Regulatory monitoring", desc: "POJK, DSN-MUI, ISO, BI, OJK — scanned every 6 hours by the NIZAM agent. Classified by severity. Alerts via WhatsApp.", color: CORAL },
            { icon: TrendingUp, title: "Portfolio tracking", desc: "Sharia-compliant instruments: sukuk, gold, mutual funds, deposits. Real-time pricing during IDX market hours.", color: TEAL },
            { icon: FileText, title: "Audit trail", desc: "Every action logged. AURIX agent performs Benford's Law analysis and ISA 240 fraud detection on your data.", color: GOLD },
            { icon: Bot, title: "12 AI agents", desc: "From MONI (command) to MUHTASIB (internal control). Each agent carries an Arabic name embodying its GRC role.", color: "#6366F1" },
            { icon: Lock, title: "Schema-per-tenant", desc: "PostgreSQL isolation per organization. Your data never touches another tenant's schema. Enterprise-grade security.", color: DEEP },
            { icon: Globe, title: "Dual payment gateway", desc: "Stripe for international. Midtrans for Indonesian customers. Pay in IDR or USD. Invoices in both languages.", color: "#2D7A4F" },
          ].map((feat, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 12, padding: 32,
              border: "1px solid rgba(200,148,62,0.1)",
              transition: "all 0.25s",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: `${feat.color}12`, display: "flex",
                alignItems: "center", justifyContent: "center", marginBottom: 20,
              }}>
                <feat.icon size={22} color={feat.color} />
              </div>
              <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: 20, fontWeight: 700, color: DEEP, marginBottom: 8 }}>{feat.title}</h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── AGENTS ────────────────────────────── */}
      <section id="agents" style={{ background: DEEP, padding: "96px 24px", position: "relative", overflow: "hidden" }}>
        <GeometricPattern opacity={0.04} />
        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: GOLD, letterSpacing: "0.15em", marginBottom: 12 }}>AGENT HIERARCHY</div>
            <h2 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 40, fontWeight: 800, color: "#FAFAF7" }}>
              12 agents. 3 tiers. One mission.
            </h2>
          </div>

          {[
            { tier: "Executive", color: GOLD, agents: [
              { id: "MONI", desc: "Chief Command — orchestrates all agents" },
              { id: "FALAH", desc: "Sharia wealth management & portfolio" },
              { id: "AURIX", desc: "AI audit intelligence & fraud detection" },
            ]},
            { tier: "Director", color: TEAL, agents: [
              { id: "TAKWA", desc: "Governance & ethics" },
              { id: "AMANAH", desc: "Risk management" },
              { id: "HIKMAH", desc: "Strategic intelligence" },
              { id: "BASYAR", desc: "HR & people analytics" },
            ]},
            { tier: "Lead", color: "#64748B", agents: [
              { id: "NIZAM", desc: "Regulatory intel" },
              { id: "AMAN", desc: "Cybersecurity" },
              { id: "RA'IS", desc: "Communications" },
              { id: "WASIT", desc: "Quality assurance" },
              { id: "MUHTASIB", desc: "Internal control" },
            ]},
          ].map((tier, i) => (
            <div key={i} style={{ marginBottom: 32 }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                color: tier.color, letterSpacing: "0.12em", marginBottom: 12,
              }}>{tier.tier.toUpperCase()} TIER</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {tier.agents.map(agent => (
                  <div key={agent.id} style={{
                    flex: "1 1 180px", padding: "16px 20px", borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${tier.color}22`,
                  }}>
                    <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 20, fontWeight: 700, color: "#FAFAF7" }}>{agent.id}</div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>{agent.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{
            textAlign: "center", marginTop: 40, padding: "20px 32px",
            borderRadius: 8, background: "rgba(13,115,119,0.08)",
            border: "1px solid rgba(13,115,119,0.15)",
          }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: TEAL }}>
              Powered by Hermes Agent (NousResearch) — self-improving learning loop
            </span>
          </div>
        </div>
      </section>

      {/* ─── PRICING ───────────────────────────── */}
      <section id="pricing" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: GOLD, letterSpacing: "0.15em", marginBottom: 12 }}>PRICING</div>
            <h2 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 40, fontWeight: 800, color: DEEP }}>
              Three tiers of vigilance.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { id: "starter", name: "Starter", price: "Gratis", period: "/bulan", features: ["1 user", "3 agents", "POJK only", "10 instruments", "30-day audit trail"] },
              { id: "pro", name: "Pro", price: "Rp 499K", period: "/bulan", features: ["5 users", "7 agents", "POJK + DSN-MUI + ISO + BI", "50 instruments", "1-year audit trail", "WhatsApp alerts", "1,000 API req/day"], recommended: true },
              { id: "enterprise", name: "Enterprise", price: "Rp 1.499K", period: "/bulan", features: ["Unlimited users", "12 agents (all tiers)", "All sources + custom", "Unlimited instruments", "7-year audit trail", "Priority WhatsApp", "10,000 API req/day", "Hermes self-evolution"] },
            ].map(plan => (
              <div key={plan.id} style={{
                background: plan.recommended ? DEEP : "#fff",
                borderRadius: 16, padding: 32, position: "relative",
                border: plan.recommended ? "none" : "1px solid rgba(200,148,62,0.12)",
              }}>
                {plan.recommended && (
                  <div style={{
                    position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                    background: `linear-gradient(135deg, ${GOLD}, #A67A2E)`,
                    color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 18px",
                    borderRadius: 20, fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.08em",
                  }}>RECOMMENDED</div>
                )}
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  color: plan.recommended ? GOLD_L : "#64748B",
                  letterSpacing: "0.1em", marginBottom: 8,
                }}>{plan.name.toUpperCase()}</div>
                <div style={{
                  fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 36,
                  fontWeight: 800, color: plan.recommended ? GOLD : DEEP,
                }}>{plan.price}</div>
                <div style={{ fontSize: 13, color: plan.recommended ? GOLD_L : "#64748B", marginBottom: 24 }}>{plan.period}</div>
                <div style={{ width: "100%", height: 1, background: plan.recommended ? "rgba(232,196,122,0.15)" : "rgba(200,148,62,0.1)", marginBottom: 24 }} />
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <CheckCircle size={14} color={plan.recommended ? GOLD_L : "#2D7A4F"} />
                    <span style={{ fontSize: 14, color: plan.recommended ? "#E2E8F0" : "#2D3748" }}>{f}</span>
                  </div>
                ))}
                <button className={plan.recommended ? "btn-gold" : "btn-outline"} style={{
                  width: "100%", marginTop: 24, justifyContent: "center",
                }}>
                  {plan.id === "starter" ? "Start free" : plan.id === "pro" ? "Get Pro" : "Contact sales"}
                </button>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
            Stripe (international) + Midtrans (Indonesia) · Cancel anytime
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────── */}
      <section style={{
        background: DEEP, padding: "80px 24px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <GeometricPattern opacity={0.03} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ fontFamily: "'Noto Naskh Arabic', serif", fontSize: 32, color: GOLD, marginBottom: 16, direction: "rtl" }}>رقيب</div>
          <h2 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 36, fontWeight: 800, color: "#FAFAF7", marginBottom: 16 }}>
            Your compliance is always watched.
          </h2>
          <p style={{ fontSize: 17, color: GOLD_L, fontStyle: "italic", marginBottom: 40 }}>
            Start monitoring regulations, tracking portfolios, and auditing with AI — today.
          </p>
          <button className="btn-gold" style={{ fontSize: 16, padding: "16px 40px" }}>
            Get started free <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────── */}
      <footer style={{
        background: "#06090F", padding: "48px 24px 32px",
        borderTop: `1px solid rgba(200,148,62,0.08)`,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShieldLogo size={24} dark />
              <span style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 18, fontWeight: 800, color: "#FAFAF7" }}>RAQIB</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.8 }}>
              The Watchful Guardian of Compliance<br />
              Built by KIM Consulting · Jakarta, Indonesia<br />
              Powered by Hermes Agent (NousResearch)
            </div>
          </div>
          <div style={{ display: "flex", gap: 48 }}>
            {[
              { title: "Product", links: ["Features", "Pricing", "API Docs", "Changelog"] },
              { title: "Resources", links: ["Blog", "Case Studies", "POJK Guide", "DSN-MUI Index"] },
              { title: "Company", links: ["About", "Contact", "Careers", "Security"] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: GOLD, letterSpacing: "0.1em", marginBottom: 12 }}>{col.title.toUpperCase()}</div>
                {col.links.map(link => (
                  <div key={link} style={{ fontSize: 13, color: "#94A3B8", marginBottom: 8, cursor: "pointer" }}>{link}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{
          maxWidth: 1100, margin: "32px auto 0", paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex", justifyContent: "space-between",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#475569",
        }}>
          <span>© 2026 KIM Consulting / MS Hadianto. All rights reserved.</span>
          <span>raqib.ai · hello@raqib.ai</span>
        </div>
      </footer>
    </div>
  );
}
