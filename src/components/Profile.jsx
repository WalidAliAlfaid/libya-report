import React, { useState, useEffect } from "react";
import { getDeviceFingerprint, getUserBadges } from "../services/fingerprint";
import { dbService } from "../services/db";
import { strings } from "../locales/strings";
import { showToast } from "./NotificationToast";

export default function Profile({ lang, watchAreas, setWatchAreas, startWatchDrawing, onAdminClick, mapStyle, setMapStyle, setLang }) {
  const [id, setId]     = useState("");
  const [score, setScore]           = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const t = strings[lang];

  useEffect(() => {
    const devId = getDeviceFingerprint();
    setId(devId);
    const calc = () => {
      const all  = dbService.getReports();
      const mine = all.filter(r => r.deviceId === devId);
      setReportCount(mine.length);
      const baseScore = mine.reduce((s,r) => s + 10 + (r.photo ? 10 : 0), 0);
      const penalty = parseInt(localStorage.getItem("libya_report_merit_penalty") || "0", 10);
      setScore(Math.max(0, baseScore - penalty));
    };
    calc();
    window.addEventListener("libya_report_new",    calc);
    window.addEventListener("libya_report_synced", calc);
    return () => {
      window.removeEventListener("libya_report_new",    calc);
      window.removeEventListener("libya_report_synced", calc);
    };
  }, []);

  const badges = getUserBadges(score);

  const BADGE_DEFS = [
    { key:"activeCitizen", label:t.activeCitizen,  req:"10+",  icon:"🏅" },
    { key:"communityHero", label:t.communityHero,  req:"40+",  icon:"🥈" },
    { key:"civicLeader",   label:t.civicLeader,    req:"100+", icon:"🏆" },
  ];

  const removeWatch = (wid) => {
    const next = watchAreas.filter(w => w.id !== wid);
    setWatchAreas(next);
    localStorage.setItem("libya_report_watch_areas", JSON.stringify(next));
    showToast(lang==="en"?"Watch area removed.":"تم إزالة منطقة المتابعة.","info");
  };

  return (
    <>
      {/* Hero score */}
      <div className="profile-hero">
        <div className="avatar-ring">🧑</div>
        <div className="profile-score-big">{score}</div>
        <div className="profile-score-sub">
          {lang==="en"
            ? `${reportCount} reports · ${score} points earned`
            : `${reportCount} بلاغ · ${score} نقطة مكتسبة`}
        </div>
      </div>



      {/* Badges */}
      <p className="section-hd">{t.badges}</p>
      <div className="badge-strip">
        {BADGE_DEFS.map(b => (
          <div key={b.key} className={`badge-pill ${badges.includes(b.key)?"earned":""}`}>
            {b.icon} {b.label} ({b.req})
          </div>
        ))}
      </div>

      {/* Watch Areas */}
      <p className="section-hd" style={{ marginTop:"24px" }}>{t.watchAreas}</p>
      <button className="btn-submit" style={{ marginBottom:"12px", padding:"12px" }} onClick={startWatchDrawing}>
        + {t.addWatchArea}
      </button>

      {watchAreas.length === 0 ? (
        <p style={{ fontSize:"0.82rem", color:"var(--tx-3)", textAlign:"center", padding:"14px 0" }}>
          {lang==="en"?"No watch areas yet.":"لا توجد مناطق متابعة بعد."}
        </p>
      ) : watchAreas.map(w => (
        <div key={w.id} className="watch-item">
          <div>
            <div className="watch-label">
              🔵 {lang==="en"?"Watch circle":"دائرة مراقبة"} — {(w.radius/1000).toFixed(1)} km
            </div>
            <div className="watch-sub">{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</div>
          </div>
          <button className="icon-btn" onClick={() => removeWatch(w.id)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      ))}

      {/* Map Settings */}
      <p className="section-hd" style={{ marginTop: "24px" }}>
        {lang === "en" ? "Map Settings" : "إعدادات الخريطة"}
      </p>
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-md)",
        padding: "12px",
        marginBottom: "20px"
      }}>
        <label style={{ 
          fontSize: "0.8rem", 
          color: "var(--tx-2)", 
          display: "block", 
          marginBottom: "8px",
          fontWeight: 600
        }}>
          {lang === "en" ? "Preferred Map Style" : "أسلوب الخريطة المفضل"}
        </label>
        <select 
          value={mapStyle} 
          onChange={(e) => setMapStyle(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "var(--r-sm)",
            background: "#070b14",
            border: "1px solid var(--border-subtle)",
            color: "var(--tx-1)",
            fontSize: "0.82rem",
            outline: "none",
            fontFamily: "var(--font)"
          }}
        >
          <option value="voyager">{lang === "en" ? "Clean (MapTiler)" : "مبسط (ماب-تايلر)"}</option>
          <option value="detailed">{lang === "en" ? "Detailed (MapTiler)" : "تفصيلي (ماب-تايلر)"}</option>
          <option value="satellite">{lang === "en" ? "Satellite (Esri)" : "فضائي (إزري)"}</option>
          <option value="esri_streets">{lang === "en" ? "Streets (Esri)" : "شوارع (إزري)"}</option>
          <option value="esri_topo">{lang === "en" ? "Topographic (Esri)" : "طبوغرافي (إزري)"}</option>
        </select>
      </div>

      {/* Language Settings */}
      <p className="section-hd" style={{ marginTop: "24px" }}>
        {lang === "en" ? "App Language" : "لغة التطبيق"}
      </p>
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-md)",
        padding: "12px",
        marginBottom: "20px"
      }}>
        <label style={{ 
          fontSize: "0.8rem", 
          color: "var(--tx-2)", 
          display: "block", 
          marginBottom: "8px",
          fontWeight: 600
        }}>
          {lang === "en" ? "Select Language" : "اختر اللغة"}
        </label>
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "var(--r-sm)",
            background: "#070b14",
            border: "1px solid var(--border-subtle)",
            color: "var(--tx-1)",
            fontSize: "0.82rem",
            outline: "none",
            fontFamily: "var(--font)"
          }}
        >
          <option value="ar">العربية (Arabic)</option>
          <option value="en">English</option>
        </select>
      </div>

      {/* Footer Area with Device ID and Official Login side-by-side at the bottom */}
      <div style={{ 
        marginTop: "20px", 
        paddingTop: "15px", 
        borderTop: "1px solid var(--border-subtle)", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        <div style={{ fontSize: "0.68rem", color: "var(--tx-3)" }}>
          <span style={{ fontWeight: 600 }}>ID:</span> <span style={{ fontFamily: "monospace" }}>{id}</span>
        </div>
        <button 
          onClick={onAdminClick}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-sm)",
            padding: "6px 12px",
            color: "var(--tx-2)",
            fontSize: "0.72rem",
            cursor: "pointer",
            fontFamily: "var(--font)",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--gold-400)";
            e.currentTarget.style.color = "var(--tx-1)";
            e.currentTarget.style.background = "rgba(212,168,83,0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-subtle)";
            e.currentTarget.style.color = "var(--tx-2)";
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
          }}
        >
          🛡️ {lang === "en" ? "Official Login" : "دخول المسؤولين"}
        </button>
      </div>
    </>
  );
}
