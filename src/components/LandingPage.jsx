import React, { useState, useEffect, useRef } from "react";

const FEATURES = [
  {
    icon: "⚡",
    en: "Electricity Outage",
    ar: "انقطاع الكهرباء",
    color: "#d4a853",
    desc_en: "Report power failures directly to local electricity authorities with tracking logs",
    desc_ar: "أبلغ شركة الكهرباء مباشرة ووثّق وقت الاستجابة والإصلاح بدقة",
    delay: 0
  },
  {
    icon: "🌊",
    en: "Flooding & Drainage",
    ar: "الفيضانات وتصريف المياه",
    color: "#3b82f6",
    desc_en: "Escalate flooded routes and sewage blocks to municipal emergency channels",
    desc_ar: "صعّد بلاغات انسداد الصرف والسيول إلى غرف طوارئ البلديات المحلية",
    delay: 0.1
  },
  {
    icon: "💡",
    en: "Broken Streetlights",
    ar: "أعمدة الإنارة المعطلة",
    color: "#eab308",
    desc_en: "Log lighting failures and record how long they take public service crews to resolve",
    desc_ar: "سجل أعمدة الإنارة المظلمة ووثق الأيام المستغرقة للصيانة",
    delay: 0.2
  },
  {
    icon: "💧",
    en: "Water & Utility Leaks",
    ar: "تسريبات المياه والمرافق",
    color: "#06b6d4",
    desc_en: "Flag pipe bursts to utility departments and track historical records of repairs",
    desc_ar: "أبلغ شركة المياه عن الكسور وتابع الأرشيف الزمني لعمليات الإصلاح",
    delay: 0.3
  },
  {
    icon: "💬",
    en: "Resolution Metrics",
    ar: "مؤشرات وقت الحل",
    color: "#8b5cf6",
    desc_en: "Keep a transparent historic record of resolution times for all civic problems",
    desc_ar: "احفظ أرشيفاً عاماً وشفافاً للمدد الزمنية المستغرقة لحل كل عطل خدمي",
    delay: 0.4
  },
  {
    icon: "📳",
    en: "Backup SMS Dispatch",
    ar: "الإرسال الاحتياطي بالـ SMS",
    color: "#22c55e",
    desc_en: "Send compressed emergency reports directly to municipal centers via cellular SMS networks when internet fails",
    desc_ar: "أرسل تقارير مشفرة ومضغوطة مباشرة لمراكز البلديات عبر شبكة المدار وليبيانا عند انقطاع الإنترنت",
    delay: 0.5
  }
];

const STEPS = [
  { icon: "✍️", en: "Submit Citizen Report", ar: "تقديم بلاغ مواطن", color: "#d4a853" },
  { icon: "📍", en: "Map Issue Gating", ar: "تحديد الموقع الجغرافي", color: "#f43f5e" },
  { icon: "🏢", en: "Escalate to Authorities", ar: "تصعيد للجهات المختصة", color: "#3b82f6" },
  { icon: "⏱️", en: "Track Resolution Timeline", ar: "تتبع وقت الحل والحلول", color: "#22c55e" },
];

export default function LandingPage({ onEnterApp }) {
  const [lang, setLang] = useState("ar");
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [pulse, setPulse] = useState(false);
  const stepRef = useRef(null);

  const isRTL = lang === "ar";

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);

    // Cycle through steps
    const stepTimer = setInterval(() => {
      setActiveStep(s => (s + 1) % STEPS.length);
    }, 2200);

    // Pulse the CTA
    const pulseTimer = setInterval(() => {
      setPulse(p => !p);
    }, 1800);

    return () => {
      clearInterval(stepTimer);
      clearInterval(pulseTimer);
    };
  }, []);

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 20% 0%, rgba(212,168,83,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(59,130,246,0.1) 0%, transparent 50%), #070b14",
        fontFamily: "'Cairo', 'Inter', sans-serif",
        overflowY: "auto",
        overflowX: "hidden",
        color: "#f1f5f9",
      }}
    >
      {/* Animated starfield background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(60)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: Math.random() * 2.5 + 0.5 + "px",
              height: Math.random() * 2.5 + 0.5 + "px",
              borderRadius: "50%",
              background: "rgba(255,255,255," + (Math.random() * 0.5 + 0.1) + ")",
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              animation: `twinkle ${Math.random() * 4 + 2}s ease-in-out infinite ${Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      {/* Language toggle */}
      <div style={{ position: "fixed", top: 18, left: isRTL ? 18 : "auto", right: isRTL ? "auto" : 18, zIndex: 100 }}>
        <button
          onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 9999,
            color: "#d4a853",
            fontWeight: 700,
            fontSize: "0.82rem",
            padding: "8px 18px",
            cursor: "pointer",
            backdropFilter: "blur(20px)",
            fontFamily: "'Cairo','Inter',sans-serif",
            letterSpacing: "0.3px"
          }}
        >
          {lang === "ar" ? "English" : "العربية"}
        </button>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ═══════════════════ HERO ═══════════════════ */}
        <section style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}>

          {/* Logo mark */}
          <div
            style={{
              width: 90, height: 90,
              borderRadius: 28,
              background: "linear-gradient(135deg, #f8c96b 0%, #d4a853 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2.8rem",
              boxShadow: "0 0 60px rgba(212,168,83,0.5), 0 20px 40px rgba(0,0,0,0.4)",
              marginBottom: 28,
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.8)",
              transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            🗺️
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "clamp(2.4rem, 7vw, 5rem)",
              fontWeight: 900,
              letterSpacing: isRTL ? "-0.5px" : "-2px",
              marginBottom: 8,
              lineHeight: 1.1,
              background: "linear-gradient(135deg, #fff 40%, #d4a853 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s",
            }}
          >
            {lang === "ar" ? "بلاغات ليبيا" : "Libya Reports"}
          </h1>

          <p
            style={{
              fontSize: "clamp(1rem, 3vw, 1.4rem)",
              color: "rgba(212,168,83,0.85)",
              fontWeight: 600,
              marginBottom: 18,
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s",
            }}
          >
            {lang === "ar" ? "رصد المشاكل، إبلاغ السلطات وتتبع الحلول" : "Report Issues, Alert Authorities & Track Resolutions"}
          </p>

          <p
            style={{
              maxWidth: 520,
              fontSize: "clamp(0.9rem, 2.5vw, 1.05rem)",
              color: "rgba(148,163,184,0.9)",
              lineHeight: 1.7,
              marginBottom: 44,
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s",
            }}
          >
            {lang === "ar"
              ? "بوابتك المباشرة لإبلاغ الجهات المختصة والبلديات عن أعطال البنية التحتية. نسجل البلاغ بالوقت والتاريخ، ونحسب المدة الزمنية المستغرقة للحل لضمان المساءلة والسرعة."
              : "Your direct channel to report infrastructure failures to competent authorities. We record reports with timestamp data, measuring the exact resolution times to guarantee accountability and speed."}
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              justifyContent: "center",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s",
            }}
          >
            <a
              href="https://github.com/WalidAliAlfaid/libya-report/releases/latest/download/libyareport.apk"
              download="libya-report-latest.apk"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "16px 32px",
                borderRadius: 9999,
                background: "linear-gradient(135deg, #f8c96b 0%, #d4a853 100%)",
                color: "#1a0900",
                fontWeight: 800,
                fontSize: "1rem",
                textDecoration: "none",
                boxShadow: pulse
                  ? "0 0 0 12px rgba(212,168,83,0.15), 0 8px 32px rgba(212,168,83,0.5)"
                  : "0 0 0 0px rgba(212,168,83,0), 0 8px 32px rgba(212,168,83,0.3)",
                transition: "box-shadow 0.8s ease, transform 0.2s ease",
                transform: "scale(1)",
                fontFamily: "'Cairo','Inter',sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <span style={{ fontSize: "1.3rem" }}>📱</span>
              {lang === "ar" ? "تحميل التطبيق" : "Download APK"}
            </a>

            <button
              onClick={onEnterApp}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "16px 32px",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.06)",
                border: "1.5px solid rgba(255,255,255,0.14)",
                color: "#f1f5f9",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
                backdropFilter: "blur(20px)",
                fontFamily: "'Cairo','Inter',sans-serif",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = "rgba(212,168,83,0.4)"; e.currentTarget.style.transform = "scale(1.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.transform = "scale(1)"; }}
            >
              <span style={{ fontSize: "1.3rem" }}>🌐</span>
              {lang === "ar" ? "استخدم النسخة الإلكترونية" : "Use Web Version"}
            </button>
          </div>

          {/* Scroll hint */}
          <div
            style={{
              position: "absolute",
              bottom: 28,
              left: "50%",
              transform: "translateX(-50%)",
              opacity: visible ? 0.5 : 0,
              transition: "opacity 1s 1s",
              animation: "bounce 2s ease-in-out infinite",
              fontSize: "1.5rem"
            }}
          >
            ↓
          </div>
        </section>

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <section style={{ padding: "80px 24px", maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 9999, background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.25)", color: "#d4a853", fontWeight: 700, fontSize: "0.8rem", marginBottom: 16, letterSpacing: "1px" }}>
              {lang === "ar" ? "كيف يعمل" : "HOW IT WORKS"}
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 900, letterSpacing: isRTL ? "-0.5px" : "-1px", lineHeight: 1.2 }}>
              {lang === "ar" ? "أربع خطوات فقط" : "Four Simple Steps"}
            </h2>
          </div>

          {/* Steps timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
            {/* connecting line */}
            <div style={{
              position: "absolute",
              [isRTL ? "right" : "left"]: 31,
              top: 0, bottom: 0, width: 2,
              background: "linear-gradient(to bottom, rgba(212,168,83,0.4), rgba(59,130,246,0.4))",
              zIndex: 0
            }} />

            {STEPS.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 24,
                  padding: "24px 0",
                  position: "relative",
                  zIndex: 1,
                  opacity: activeStep === i ? 1 : 0.45,
                  transform: activeStep === i ? "translateX(0)" : (isRTL ? "translateX(-8px)" : "translateX(8px)"),
                  transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                <div style={{
                  width: 62, height: 62, flexShrink: 0,
                  borderRadius: 20,
                  background: activeStep === i ? step.color : "rgba(255,255,255,0.04)",
                  border: activeStep === i ? `2px solid ${step.color}` : "2px solid rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.8rem",
                  transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
                  boxShadow: activeStep === i ? `0 0 24px ${step.color}55` : "none",
                }}>
                  {step.icon}
                </div>
                <div style={{ paddingTop: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 4, color: activeStep === i ? step.color : "#94a3b8" }}>
                    {lang === "ar" ? step.ar : step.en}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                    {lang === "ar"
                      ? ["الخطوة الأولى: أنشئ البلاغ بجميع التفاصيل والصور", "الخطوة الثانية: حدد مكان المشكلة على الخريطة الجغرافية بدقة", "الخطوة الثالثة: يتم تحويل البلاغ وتنبيه الجهات الحكومية والخدمية المعنية", "الخطوة الرابعة: يسجل النظام وقت وتاريخ البلاغ ويتابع مدة الإنجاز حتى الإغلاق"][i]
                      : ["Step 1: Create the civic report with photos and description", "Step 2: Pin the exact location on the map automatically", "Step 3: Issue is routed to the competent municipal or state authorities", "Step 4: The system tracks and logs resolution time until the issue is solved"][i]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════ FEATURES GRID ═══════════════════ */}
        <section style={{ padding: "80px 24px", maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 9999, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#3b82f6", fontWeight: 700, fontSize: "0.8rem", marginBottom: 16, letterSpacing: "1px" }}>
              {lang === "ar" ? "الميزات" : "FEATURES"}
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 900, letterSpacing: isRTL ? "-0.5px" : "-1px" }}>
              {lang === "ar" ? "كل ما تحتاجه في مكان واحد" : "Everything You Need"}
            </h2>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} feature={f} lang={lang} isRTL={isRTL} />
            ))}
          </div>
        </section>

        {/* ═══════════════════ STATS ═══════════════════ */}
        <section style={{ padding: "60px 24px", textAlign: "center" }}>
          <div style={{
            maxWidth: 700,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
          }}>
            {[
              { num: "10km", label_ar: "نطاق الدردشة المحلية", label_en: "Local Chat Radius" },
              { num: "100%", label_ar: "مجاني ومفتوح", label_en: "Free & Open Source" },
              { num: "3×", label_ar: "قنوات اتصال", label_en: "Communication Layers" },
            ].map((stat, i) => (
              <div key={i} style={{ padding: "32px 16px" }}>
                <div style={{
                  fontSize: "clamp(2rem, 5vw, 3.5rem)",
                  fontWeight: 900,
                  background: "linear-gradient(135deg, #f8c96b, #d4a853)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-2px",
                  lineHeight: 1
                }}>{stat.num}</div>
                <div style={{ color: "#475569", fontWeight: 600, marginTop: 8, fontSize: "0.85rem" }}>
                  {lang === "ar" ? stat.label_ar : stat.label_en}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════ FINAL CTA ═══════════════════ */}
        <section style={{ padding: "80px 24px 120px", textAlign: "center" }}>
          <div style={{
            maxWidth: 680,
            margin: "0 auto",
            borderRadius: 36,
            background: "radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.18) 0%, rgba(7,11,20,0.95) 70%)",
            border: "1px solid rgba(212,168,83,0.2)",
            padding: "clamp(48px, 8vw, 80px) clamp(24px, 6vw, 60px)",
          }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🇱🇾</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 5vw, 2.8rem)", fontWeight: 900, marginBottom: 16, letterSpacing: isRTL ? "-0.5px" : "-1px", lineHeight: 1.2 }}>
              {lang === "ar" ? "ابدأ الإبلاغ الآن" : "Start Reporting Today"}
            </h2>
            <p style={{ color: "rgba(148,163,184,0.9)", fontSize: "1rem", lineHeight: 1.6, marginBottom: 40, maxWidth: 440, margin: "0 auto 40px" }}>
              {lang === "ar"
                ? "انضم إلى مجتمع المواطنين الذين يجعلون ليبيا أفضل، بلاغاً واحداً في كل مرة."
                : "Join the community of citizens making Libya better, one report at a time."}
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <a
                href="https://github.com/WalidAliAlfaid/libya-report/releases/latest/download/libyareport.apk"
                download="libya-report-latest.apk"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "18px 36px",
                  borderRadius: 9999,
                  background: "linear-gradient(135deg, #f8c96b 0%, #d4a853 100%)",
                  color: "#1a0900",
                  fontWeight: 800,
                  fontSize: "1.05rem",
                  textDecoration: "none",
                  boxShadow: "0 8px 32px rgba(212,168,83,0.4)",
                  fontFamily: "'Cairo','Inter',sans-serif",
                  transition: "transform 0.2s ease",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                <span style={{ fontSize: "1.3rem" }}>📱</span>
                {lang === "ar" ? "تحميل التطبيق — مجاناً" : "Download APK — Free"}
              </a>
              <button
                onClick={onEnterApp}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "18px 36px",
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.06)",
                  border: "1.5px solid rgba(255,255,255,0.14)",
                  color: "#f1f5f9",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  cursor: "pointer",
                  fontFamily: "'Cairo','Inter',sans-serif",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "scale(1.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "scale(1)"; }}
              >
                <span style={{ fontSize: "1.3rem" }}>🌐</span>
                {lang === "ar" ? "استخدم النسخة الإلكترونية" : "Use Web Version"}
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ padding: "24px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(71,85,105,0.8)", fontSize: "0.8rem" }}>
          {lang === "ar"
            ? "بلاغات ليبيا © 2026 — مبني بحب لليبيا"
            : "Libya Reports © 2026 — Built with ♥ for Libya"}
        </footer>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300..900&family=Inter:wght@300..900&display=swap');
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.4); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ feature, lang, isRTL }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 20,
        padding: "28px 24px",
        background: hovered
          ? `radial-gradient(ellipse at 30% 30%, ${feature.color}18 0%, rgba(13,18,32,0.98) 70%)`
          : "rgba(255,255,255,0.025)",
        border: hovered
          ? `1.5px solid ${feature.color}55`
          : "1.5px solid rgba(255,255,255,0.07)",
        transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        cursor: "default",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{
        width: 52, height: 52,
        borderRadius: 16,
        background: `${feature.color}18`,
        border: `1.5px solid ${feature.color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.6rem",
        transition: "all 0.3s",
        boxShadow: hovered ? `0 0 20px ${feature.color}44` : "none",
      }}>
        {feature.icon}
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: "1rem", color: hovered ? feature.color : "#f1f5f9", transition: "color 0.3s", marginBottom: 4 }}>
          {lang === "ar" ? feature.ar : feature.en}
        </div>
        <div style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.5 }}>
          {lang === "ar" ? feature.desc_ar : feature.desc_en}
        </div>
      </div>
    </div>
  );
}
