import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { strings } from "../locales/strings";
import { dbService } from "../services/db";
import { showToast } from "./NotificationToast";
import { auth, isConfigured } from "../services/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import AppLogo from "./AppLogo";


const CAT_CLR = { electricity:"#d4a853", flooding:"#3b82f6", streetlight:"#eab308", waterLeak:"#06b6d4", other:"#8b5cf6" };
const CAT_EMJ = { electricity:"⚡", flooding:"🌊", streetlight:"💡", waterLeak:"💧", other:"⚠️" };

const getElapsedString = (timestamp, lang) => {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (lang === "ar") {
    if (diffMins < 1) return "منذ أقل من دقيقة";
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours === 1) return "منذ ساعة واحدة";
    if (diffHours === 2) return "منذ ساعتين";
    if (diffHours < 11) return `منذ ${diffHours} ساعات`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays === 1) return "منذ يوم واحد";
    if (diffDays === 2) return "منذ يومين";
    if (diffDays < 11) return `منذ ${diffDays} أيام`;
    return `منذ ${diffDays} يوم`;
  } else {
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
};

export default function AdminPortal({ lang, reports, setReports, onClose, onLoginSuccess, onLogout }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(""); const [pass, setPass] = useState("");
  const [fCat, setFCat] = useState("all");
  const [fStat, setFStat] = useState("all");
  const [fDays, setFDays] = useState("30");
  const [photoView, setPhotoView] = useState(null);
  const [banned, setBanned] = useState([]);
  const [exportTarget, setExportTarget] = useState(null);
  const [exportReason, setExportReason] = useState("false_reports");
  const [exportNotes, setExportNotes] = useState("");
  const heatEl = useRef(null); const heatMap = useRef(null); const heatLyr = useRef(null);
  const t = strings[lang];

  useEffect(() => {
    setBanned(dbService.getBannedDevices());
    if (localStorage.getItem("libya_report_is_admin") === "true") {
      setLoggedIn(true);
      if (onLoginSuccess) onLoginSuccess();
    }
  }, []);

  const filter = (list) => list.filter(r => {
    const c = fCat  === "all" || r.category === fCat;
    const s = fStat === "all" || r.status   === fStat;
    const d = fDays === "all" || (Date.now()-r.timestamp)/86400000 <= +fDays;
    return c && s && d;
  });

  const filtered = filter(reports);

  useEffect(() => {
    if (!loggedIn || !heatEl.current) return;
    if (!heatMap.current) {
      const m = L.map(heatEl.current, { center:[29,17], zoom:4, zoomControl:false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution:"&copy; CARTO" }).addTo(m);
      heatMap.current = m; heatLyr.current = L.layerGroup().addTo(m);
    }
    heatLyr.current.clearLayers();
    const grp = {};
    filtered.forEach(r => { const k=`${r.lat.toFixed(1)}_${r.lng.toFixed(1)}`; grp[k]=grp[k]||{lat:r.lat,lng:r.lng,n:0}; grp[k].n++; });
    Object.values(grp).forEach(p => {
      const col = p.n > 3 ? "#f43f5e" : p.n > 1 ? "#f59e0b" : "#3b82f6";
      L.circle([p.lat,p.lng],{ radius:80000+p.n*45000, color:col, weight:1, fillColor:col, fillOpacity:Math.min(0.12+p.n*0.12,0.72), interactive:false }).addTo(heatLyr.current);
    });
  }, [loggedIn, filtered]);

  const login = async (e) => {
    e.preventDefault();
    if (!isConfigured) {
      showToast(lang === "en" ? "Firebase Auth is not configured in this environment." : "المصادقة عبر فايربيس غير مهيأة في هذه البيئة.", "error");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, user, pass);
      setLoggedIn(true);
      localStorage.setItem("libya_report_is_admin", "true");
      if (onLoginSuccess) onLoginSuccess();
      showToast(lang === "en" ? "Logged in securely via Firebase." : "تم تسجيل الدخول بنجاح عبر فايربيس.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };
  const setStatus = (id,s) => { dbService.updateReportStatus(id,s); setReports(dbService.getReports()); showToast(lang==="en"?"Status updated!":"تم تحديث الحالة!","success"); };
  const del = (id) => { if(!window.confirm(lang==="en"?"Delete report?":"حذف البلاغ؟"))return; dbService.deleteReport(id); setReports(dbService.getReports()); };
  const toggleBan = (did) => { const b=banned.includes(did); dbService.setDeviceBanned(did,!b); setBanned(dbService.getBannedDevices()); showToast(b?(lang==="en"?"Unbanned.":"تم الإلغاء."):(lang==="en"?"Banned.":"محظور."),"warning"); };

  const exportPoliceReport = (r, reason, details) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const reportDate = new Date(r.timestamp).toLocaleString(lang === "ar" ? "ar-LY" : "en-US");
    const categoryName = t[r.category] || r.category;

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${lang === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8">
        <title>${lang === "ar" ? "سجل إثبات المخالفة الفنية" : "Platform Incident Verification Log"}</title>
        <style>
          body {
            font-family: 'Cairo', 'Inter', sans-serif;
            background: #fff;
            color: #000;
            margin: 40px;
            font-size: 14px;
            line-height: 1.6;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px double #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header-right {
            text-align: ${lang === "ar" ? "right" : "left"};
          }
          .header-left {
            text-align: ${lang === "ar" ? "left" : "right"};
          }
          .header-logo {
            text-align: center;
            flex-grow: 1;
          }
          .title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 30px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .meta-table th, .meta-table td {
            border: 1px solid #000;
            padding: 10px;
            text-align: ${lang === "ar" ? "right" : "left"};
          }
          .meta-table th {
            background-color: #f2f2f2;
            width: 30%;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-top: 25px;
            margin-bottom: 10px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
          }
          .legal-notice {
            border: 1px solid #000;
            background: #fafafa;
            padding: 15px;
            font-size: 12px;
            margin-top: 40px;
            line-height: 1.5;
            text-align: justify;
          }
          .footer-signs {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
          }
          .sign-box {
            text-align: center;
            width: 45%;
          }
          .sign-line {
            margin-top: 50px;
            border-top: 1px dashed #000;
            width: 80%;
            margin-left: auto;
            margin-right: auto;
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-right">
            <strong>منصة بلاغات ليبيا للتبليغ المدني</strong><br>
            <strong>سجل إثبات مخالفة وسوء استخدام</strong><br>
            تاريخ التصدير: ${new Date().toLocaleDateString(lang === "ar" ? "ar-LY" : "en-US")}
          </div>
          <div class="header-logo">
            <div style="font-size: 40px;">📢</div>
            <small style="display:block;margin-top:5px;font-weight:bold;">بلاغات ليبيا</small>
          </div>
          <div class="header-left">
            <strong>Libya Civic Reports Platform</strong><br>
            <strong>Incident Log & Violation File</strong><br>
            Export Date: ${new Date().toLocaleDateString("en-US")}
          </div>
        </div>

        <div class="title">
          ${lang === "ar" ? "سجل المخالفة الفنية وإثبات الهوية الرقمية للبلاغ" : "Technical Violation & Sender Cyber Telemetry Record"}
        </div>

        <table class="meta-table">
          <tr>
            <th>${lang === "ar" ? "رقم البلاغ (رمز التذكرة)" : "Ticket Reference Code"}</th>
            <td><strong>#${r.ticketCode || r.id.substring(4, 10).toUpperCase()}</strong></td>
          </tr>
          <tr>
            <th>${lang === "ar" ? "تصنيف البلاغ" : "Category"}</th>
            <td><strong>${categoryName}</strong></td>
          </tr>
          <tr>
            <th>${lang === "ar" ? "تاريخ ووقت الإرسال" : "Incident Date & Time"}</th>
            <td>${reportDate}</td>
          </tr>
          <tr>
            <th>${lang === "ar" ? "الإحداثيات الجغرافية" : "Location Coordinates"}</th>
            <td>Latitude: ${r.lat.toFixed(6)}, Longitude: ${r.lng.toFixed(6)}</td>
          </tr>
          <tr>
            <th>${lang === "ar" ? "تفاصيل محتوى البلاغ" : "Report Details"}</th>
            <td>${r.description || (lang === "ar" ? "لا يوجد تفاصيل نصية" : "No description provided")}</td>
          </tr>
        </table>

        <div class="section-title">
          ${lang === "ar" ? "تفاصيل وسبب إثبات المخالفة" : "Violation Description & Reason for Logging"}
        </div>
        <table class="meta-table">
          <tr>
            <th>${lang === "ar" ? "تصنيف المخالفة المحدد" : "Identified Violation Type"}</th>
            <td><strong style="color: #c00;">${reason}</strong></td>
          </tr>
          ${details ? `
          <tr>
            <th>${lang === "ar" ? "ملاحظات إدارية إضافية" : "Additional Platform Admin Notes"}</th>
            <td>${details}</td>
          </tr>
          ` : ""}
        </table>

        <div class="section-title">
          ${lang === "ar" ? "الأدلة التقنية وهوية المرسل الرقمية" : "Evidentiary Cyber Telemetry & Hardware ID"}
        </div>
        <table class="meta-table">
          <tr>
            <th>${lang === "ar" ? "المعرف الفريد للجهاز (Hardware ID)" : "Hardware Device ID"}</th>
            <td><code>${r.hardwareId || "N/A - WEB_FALLBACK"}</code></td>
          </tr>
          <tr>
            <th>${lang === "ar" ? "معرف المتصفح والتطبيق (Device ID)" : "Application Device ID"}</th>
            <td><code>${r.deviceId}</code></td>
          </tr>
          <tr>
            <th>${lang === "ar" ? "عنوان الإنترنت العام (IP Address)" : "Public IP Address"}</th>
            <td><code>${r.ipAddress || "N/A (Logged Offline)"}</code></td>
          </tr>
          <tr>
            <th>${lang === "ar" ? "مزود خدمة الإنترنت والاتصالات" : "ISP Provider"}</th>
            <td><strong>${r.ispProvider || "N/A (Logged Offline)"}</strong></td>
          </tr>
        </table>

        ${r.photo ? `
          <div class="section-title">${lang === "ar" ? "الملف الصوري المرفق" : "Attached Photo Asset"}</div>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${r.photo}" style="max-width: 350px; max-height: 250px; border: 1px solid #000; border-radius: 4px; padding: 4px; object-fit: contain;" />
          </div>
        ` : ""}

        ${r.video ? `
          <div class="section-title">${lang === "ar" ? "وسائط الفيديو المرفقة" : "Attached Video Evidence"}</div>
          <div style="border: 1px dashed #000; padding: 15px; text-align: center; margin: 20px 0; background: #fafafa; border-radius: 4px;">
            🎥 <strong>${lang === "ar" ? "تم إرفاق وتسجيل ملف فيديو مع هذا البلاغ" : "A recorded video file is attached to this civic report log"}</strong>
          </div>
        ` : ""}

        <div class="legal-notice">
          <strong>${lang === "ar" ? "إقرار فني للمنصة:" : "Platform Technical Certificate:"}</strong><br>
          ${lang === "ar"
            ? "تم تصدير وتجميع هذا السجل تقنياً من خلال قاعدة بيانات المنصة. تشكل المعرفات الرقمية (Hardware ID و IP Address) وعقود الإرسال سجلاً تقنياً للنشاط الصادر من الجهاز المذكور. يمكن استخدام هذه البيانات وتقديمها للمصالح الضبطية والجهات الأمنية المختصة عند اللزوم لإثبات المخالفات، البلاغات الكاذبة، أو إساءة استخدام المنصة."
            : "This log has been compiled and exported by the platform's technical backend database. The hardware identification telemetry (Hardware ID) and source IP coordinates constitute a technical record of activity from the indicated device. This file can be submitted by platform administrators to local law enforcement or judicial authorities to verify false reports, malicious spam, or platform abuse."}
        </div>

        <div class="footer-signs">
          <div class="sign-box">
            <strong>${lang === "ar" ? "مشرف المنصة الفني" : "Platform Technical Administrator"}</strong>
            <div class="sign-line"></div>
          </div>
          <div class="sign-box">
            <strong>${lang === "ar" ? "توقيع الإدارة الفنية للمنصة" : "Technical Division Signature & Stamp"}</strong>
            <div class="sign-line"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const CATS = ["electricity","flooding","streetlight","waterLeak","other"];
  const catCounts = () => { const o={}; CATS.forEach(c=>o[c]=0); filtered.forEach(r=>{if(o[r.category]!==undefined)o[r.category]++;}); return o; };
  const counts = catCounts(); const maxC = Math.max(...Object.values(counts),1);

  const timelinePts = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); const lbl=d.toLocaleDateString(lang==="en"?"en-US":"ar-EG",{weekday:"short"}); const n=filtered.filter(r=>new Date(r.timestamp).toDateString()===d.toDateString()).length; return {lbl,n}; });
  const maxT = Math.max(...timelinePts.map(p=>p.n),1);
  const W=300,H=90,pad=14;
  const pts = timelinePts.map((p,i)=>({ x:pad+(i*(W-2*pad))/6, y:H-pad-(p.n*(H-2*pad))/maxT }));
  const polyPts = pts.map(p=>`${p.x},${p.y}`).join(" ");
  // Calculate resolution times dynamically
  const resolved = reports.filter(r => r.status === "Resolved" && r.resolvedAt && r.timestamp);
  let avgText = lang === "ar" ? "لا يوجد بيانات" : "N/A";
  let fastestText = lang === "ar" ? "لا يوجد بيانات" : "N/A";

  if (resolved.length > 0) {
    const diffs = resolved.map(r => r.resolvedAt - r.timestamp);
    const sum = diffs.reduce((a, b) => a + b, 0);
    const avgMs = sum / resolved.length;
    const minMs = Math.min(...diffs);

    const formatDiff = (ms) => {
      const hours = ms / 3600000;
      if (hours < 1) {
        const mins = Math.round(ms / 60000);
        return lang === "ar" ? `${mins} دقيقة` : `${mins} mins`;
      }
      const fixedHours = hours.toFixed(1);
      return lang === "ar" ? `${fixedHours} ساعة` : `${fixedHours} hours`;
    };

    avgText = formatDiff(avgMs);
    fastestText = formatDiff(minMs);
  }

  // ── LOGIN ──
  if (!loggedIn) return (
    <div className="login-wrap" dir={t.direction}>
      <button onClick={onClose} style={{ position:"absolute",top:"20px",right:"20px",background:"var(--bg-glass-light)",border:"1px solid var(--border-subtle)",borderRadius:"10px",width:"34px",height:"34px",color:"var(--tx-2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div className="login-card">
        <div className="login-ico" style={{ background: "none", border: "none" }}>
          <AppLogo size={42} />
        </div>
        <p className="login-title">{t.officialLogin}</p>
        <p className="login-sub">{lang==="en"?"Administrative access only":"للمسؤولين فقط"}</p>
        <form onSubmit={login} style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
          <div className="field" style={{ marginBottom:0 }}>
            <label className="field-lbl">{t.username}</label>
            <input className="field-input" type="email" placeholder="admin@libyanreport.com" value={user} onChange={e=>setUser(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom:0 }}>
            <label className="field-lbl">{t.password}</label>
            <input className="field-input" type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} required />
          </div>
          <button type="submit" className="btn-submit" style={{ marginTop:"8px" }}>{t.login}</button>
        </form>
      </div>
    </div>
  );

  // ── DASHBOARD ──
  return (
    <div className="admin-shell" dir={t.direction}>
      {/* Header */}
      <div className="admin-hd">
        <div className="admin-hd-left">
          <div className="admin-logo">
            <AppLogo size={24} />
          </div>
          <div>
            <div className="admin-title">{t.adminPortal}</div>
            <div className="admin-subtitle">{filtered.length} {lang==="en"?"reports":"بلاغ"}</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:"8px" }}>
          <button className="hbtn" onClick={async () => {
            if (isConfigured) {
              try {
                await signOut(auth);
              } catch (err) {
                console.error("Firebase SignOut error:", err);
              }
            }
            setLoggedIn(false);
            localStorage.removeItem("libya_report_is_admin");
            if (onLogout) onLogout();
          }}>{lang==="en"?"Sign Out":"تسجيل خروج"}</button>
          <button className="icon-btn" onClick={onClose} style={{ width:"36px",height:"36px" }}>
            <svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="admin-body">

        {/* KPIs */}
        <div className="kpi-row">
          {[
            { v:reports.length,                              l:t.totalReports,     c:"var(--gold-400)" },
            { v:reports.filter(r=>r.status==="Reported").length,    l:t.statusReported,  c:"var(--clr-red)"   },
            { v:reports.filter(r=>r.status==="In Progress").length, l:t.statusInProgress,c:"var(--clr-amber)" },
            { v:reports.filter(r=>r.status==="Resolved").length,    l:t.statusResolved,  c:"var(--clr-green)" },
            { v:banned.length,                              l:t.bannedDevices,    c:"var(--tx-2)"      },
          ].map((k,i) => (
            <div key={i} className="kpi">
              <div className="kpi-val" style={{ color:k.c }}>{k.v}</div>
              <div className="kpi-lbl">{k.l}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="a-card">
          <div className="a-card-hd">
            🔍 {lang==="en"?"Filters":"الفلاتر"}
          </div>
          <div className="filter-row">
            <select className="f-select" value={fCat}  onChange={e=>setFCat(e.target.value)}>
              <option value="all">{t.allCategories}</option>
              {CATS.map(c=><option key={c} value={c}>{CAT_EMJ[c]} {t[c]||c}</option>)}
            </select>
            <select className="f-select" value={fStat} onChange={e=>setFStat(e.target.value)}>
              <option value="all">{t.allStatuses}</option>
              {["Reported","In Progress","Resolved"].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select className="f-select" value={fDays} onChange={e=>setFDays(e.target.value)}>
              <option value="all">{lang==="en"?"All time":"كل الأوقات"}</option>
              <option value="1">{lang==="en"?"Last 24h":"آخر 24 ساعة"}</option>
              <option value="7">{lang==="en"?"Last 7 days":"آخر 7 أيام"}</option>
              <option value="30">{lang==="en"?"Last 30 days":"آخر 30 يوم"}</option>
            </select>
          </div>
        </div>

        {/* Resolution Performance Analytics */}
        <div className="a-card" style={{ marginBottom: "16px" }}>
          <div className="a-card-hd" style={{ color: "var(--clr-green)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⏱️ {lang === "ar" ? "تحليلات كفاءة الاستجابة ووقت الحل للبلديات" : "Municipal Resolution Time & Efficiency Analytics"}</span>
            <span style={{ fontSize: "0.75rem", background: "rgba(34, 197, 94, 0.1)", color: "var(--clr-green)", padding: "2px 8px", borderRadius: "9999px" }}>
              {lang === "ar" ? "نظام التوثيق والرقابة الفنية" : "Auditing Logs Active"}
            </span>
          </div>
          <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
            
            <div style={{ background: "var(--bg-700)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.76rem", color: "var(--tx-2)", fontWeight: "600" }}>
                {lang === "ar" ? "متوسط مدة حل المشكلات" : "Average Resolution Speed"}
              </span>
              <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "var(--clr-green)", margin: "4px 0" }}>
                {avgText}
              </div>
              <span style={{ fontSize: "0.68rem", color: "var(--tx-3)" }}>
                {lang === "ar" ? "حسب المعايير القياسية للبلدية" : "Based on municipal resolution targets"}
              </span>
            </div>

            <div style={{ background: "var(--bg-700)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.76rem", color: "var(--tx-2)", fontWeight: "600" }}>
                {lang === "ar" ? "معدل الإنجاز والإغلاق" : "Resolution Success Rate"}
              </span>
              <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "var(--gold-400)", margin: "4px 0" }}>
                {reports.length > 0 
                  ? `${Math.round((reports.filter(r => r.status === "Resolved").length / reports.length) * 100)}%` 
                  : "0%"}
              </div>
              <div style={{ height: "4px", background: "var(--bg-900)", borderRadius: "2px", overflow: "hidden", marginTop: "4px" }}>
                <div style={{ 
                  width: reports.length > 0 ? `${(reports.filter(r => r.status === "Resolved").length / reports.length) * 100}%` : "0%", 
                  height: "100%", 
                  background: "var(--gold-400)" 
                }} />
              </div>
            </div>

            <div style={{ background: "var(--bg-700)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.76rem", color: "var(--tx-2)", fontWeight: "600" }}>
                {lang === "ar" ? "أسرع استجابة مسجلة" : "Fastest Recorded Action"}
              </span>
              <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "var(--clr-cyan)", margin: "4px 0" }}>
                {fastestText}
              </div>
              <span style={{ fontSize: "0.68rem", color: "var(--tx-3)" }}>
                {lang === "ar" ? "تم حلها وإثباتها بالصور" : "Verified with photo closure"}
              </span>
            </div>

          </div>
        </div>

        {/* Charts */}
        <div className="charts-grid">
          {/* Heatmap */}
          <div className="a-card" style={{ minHeight:"260px",display:"flex",flexDirection:"column" }}>
            <div className="a-card-hd">📍 {t.activeHotspots}</div>
            <div ref={heatEl} style={{ flex:1,minHeight:"200px" }} />
          </div>
          {/* Category bars */}
          <div className="a-card">
            <div className="a-card-hd">📊 {t.distributionByCategory}</div>
            <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:"12px" }}>
              {CATS.map(c => (
                <div key={c} style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                  <span style={{ width:"80px",fontSize:"0.76rem",color:"var(--tx-2)",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{CAT_EMJ[c]} {t[c]||c}</span>
                  <div style={{ flex:1,height:"8px",background:"var(--bg-600)",borderRadius:"4px",overflow:"hidden" }}>
                    <div style={{ width:`${(counts[c]/maxC)*100}%`,height:"100%",background:CAT_CLR[c],borderRadius:"4px",transition:"width 0.8s var(--ease-out-expo)" }}/>
                  </div>
                  <span style={{ fontSize:"0.75rem",fontWeight:700,width:"18px",textAlign:"right",color:"var(--tx-2)" }}>{counts[c]}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Timeline */}
          <div className="a-card">
            <div className="a-card-hd">📈 {t.reportsOverTime}</div>
            <div style={{ padding:"16px 18px" }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%",height:"90px",overflow:"visible" }}>
                <defs><linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold-400)" stopOpacity="0.3"/><stop offset="100%" stopColor="var(--gold-400)" stopOpacity="0"/></linearGradient></defs>
                <line x1={pad} y1={H-pad} x2={W-pad} y2={H-pad} stroke="var(--border-subtle)"/>
                <polygon points={areaPts} fill="url(#aGrad)"/>
                <polyline points={polyPts} fill="none" stroke="var(--gold-400)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                {pts.map((p,i)=>(<g key={i}><circle cx={p.x} cy={p.y} r="4" fill="var(--bg-800)" stroke="var(--gold-400)" strokeWidth="2"/>{timelinePts[i].n>0&&<text x={p.x} y={p.y-8} fill="var(--tx-2)" fontSize="8" textAnchor="middle">{timelinePts[i].n}</text>}</g>))}
              </svg>
              <div style={{ display:"flex",justifyContent:"space-between",marginTop:"8px" }}>
                {timelinePts.map((p,i)=><span key={i} style={{ fontSize:"0.68rem",color:"var(--tx-3)" }}>{p.lbl}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* Reports Table */}
        <div className="a-card">
          <div className="a-card-hd">📋 {t.reportsList} ({filtered.length})</div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t.category}</th>
                  <th>{t.description}</th>
                  <th>{t.status}</th>
                  <th>{t.deviceFingerprint}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign:"center",color:"var(--tx-3)",padding:"28px" }}>{t.noReports}</td></tr>
                  : filtered.map(r => {
                    const isBanned = banned.includes(r.deviceId);
                    return (
                      <tr key={r.id}>
                        <td>
                          <span style={{ fontWeight:700,whiteSpace:"nowrap" }}>{CAT_EMJ[r.category]} {t[r.category]||r.category}</span>
                        </td>
                        <td>
                          {r.status !== "Resolved" && (
                            <div style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(245, 158, 11, 0.1)",
                              border: "1px solid rgba(245, 158, 11, 0.2)",
                              color: "var(--gold-400)",
                              fontSize: "0.72rem",
                              fontWeight: "600",
                              marginBottom: "6px"
                            }}>
                              ⏳ {getElapsedString(r.timestamp, lang)}
                            </div>
                          )}
                          {r.description && <div style={{ maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--tx-2)",fontSize:"0.82rem" }}>{r.description}</div>}
                          {r.audio && (
                            <div style={{ marginTop:"3px", maxWidth:"200px" }}>
                              <audio src={r.audio} controls style={{ width:"100%",height:"26px",borderRadius:"4px",display:"block" }}></audio>
                            </div>
                          )}
                          {r.video && (
                            <div style={{ marginTop:"3px", maxWidth:"200px" }}>
                              <video src={r.video} controls style={{ width:"100%",maxHeight:"60px",borderRadius:"4px",display:"block",background:"#000" }}></video>
                            </div>
                          )}
                          {r.photo && <button onClick={()=>setPhotoView(r.photo)} style={{ background:"none",border:"none",color:"var(--gold-400)",fontSize:"0.72rem",cursor:"pointer",padding:0,marginTop:"3px" }}>👁 {t.viewPhoto}</button>}
                        </td>
                        <td>
                          <select className="f-select" value={r.status} onChange={e=>setStatus(r.id,e.target.value)} style={{ padding:"5px 8px",minWidth:"110px",fontSize:"0.78rem" }}>
                            <option value="Reported">{t.statusReported}</option>
                            <option value="In Progress">{t.statusInProgress}</option>
                            <option value="Resolved">{t.statusResolved}</option>
                          </select>
                        </td>
                        <td>
                          <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                            <span style={{ fontSize:"0.68rem",color:"var(--tx-3)",fontFamily:"monospace" }}>{r.deviceId.substring(0,10)}…</span>
                            <button onClick={()=>toggleBan(r.deviceId)} title={isBanned?t.unrestrictDevice:t.restrictDevice} style={{ background:"none",border:"none",cursor:"pointer",color:isBanned?"var(--clr-green)":"var(--clr-red)",display:"flex",alignItems:"center",padding:0 }}>
                              🛡
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display:"flex", gap:"4px" }}>
                            <button
                              className="icon-btn"
                              onClick={() => {
                                const categoryName = t[r.category] || r.category;
                                const statusName = r.status;
                                const mapLink = `https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=16/${r.lat}/${r.lng}`;
                                const msg = lang === "ar"
                                  ? `📢 *بلاغ خدمي جديد في تقرير ليبيا* 🗺️\n\n📍 *التصنيف:* ${categoryName}\n📊 *الحالة:* ${statusName}\n${r.description ? `📝 *الوصف:* ${r.description}\n` : ""}🌐 *رابط الموقع:* ${mapLink}`
                                  : `📢 *New Civic Report on Libya Report* 🗺️\n\n📍 *Category:* ${categoryName}\n📊 *Status:* ${statusName}\n${r.description ? `📝 *Description:* ${r.description}\n` : ""}🌐 *Map Location:* ${mapLink}`;
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
                              }}
                              title={t.shareWhatsApp}
                              style={{ color: "var(--clr-green)" }}
                            >
                              💬
                            </button>
                            <button
                              className="icon-btn"
                              onClick={() => {
                                setExportTarget(r);
                                setExportReason("false_reports");
                                setExportNotes("");
                              }}
                              title={lang === "en" ? "Export Incident File to Police" : "تصدير ملف القضية للشرطة"}
                              style={{ color: "var(--gold-400)", fontSize: "0.85rem" }}
                            >
                              📄
                            </button>
                            <button className="icon-btn" onClick={()=>del(r.id)} title={t.delete}>
                              <svg viewBox="0 0 24 24" width="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {photoView && (
        <div style={{ position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px" }} onClick={()=>setPhotoView(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg-800)",border:"1px solid var(--border-subtle)",borderRadius:"var(--r-xl)",padding:"16px",maxWidth:"600px",width:"100%" }}>
            <img src={photoView} alt="" style={{ width:"100%",maxHeight:"70vh",objectFit:"contain",borderRadius:"var(--r-md)",display:"block" }}/>
            <button className="btn-ghost" style={{ width:"100%",marginTop:"14px" }} onClick={()=>setPhotoView(null)}>{t.close}</button>
          </div>
        </div>
      )}

      {/* Export Report Configuration Dialog */}
      {exportTarget && (
        <div style={{ position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px" }} onClick={()=>setExportTarget(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg-800)",border:"1px solid var(--border-subtle)",borderRadius:"var(--r-xl)",padding:"24px",maxWidth:"500px",width:"100%",color:"var(--tx-1)" }}>
            <h3 style={{ marginTop:0,marginBottom:"16px",fontSize:"1.2rem",color:"var(--gold-400)",borderBottom:"1px solid var(--border-subtle)",paddingBottom:"10px" }}>
              {lang === "ar" ? "تأكيد تصدير المحضر الفني" : "Configure Incident Log Export"}
            </h3>
            <p style={{ fontSize:"0.85rem",color:"var(--tx-2)",marginBottom:"18px" }}>
              {lang === "ar" 
                ? "يرجى تحديد سبب إعداد هذا البلاغ وتصديره للجهات المختصة لإدراجه في الوثيقة المطبوعة:" 
                : "Please select the reason for compiling this incident report to display on the printed document:"}
            </p>
            
            <div style={{ display:"flex",flexDirection:"column",gap:"10px",marginBottom:"20px" }}>
              {[
                { 
                  id: "false_reports", 
                  ar: "تقديم بلاغات كاذبة أو عشوائية متكررة", 
                  en: "Repeated spamming or submitting false reports" 
                },
                { 
                  id: "harmful_media", 
                  ar: "إرفاق وسائط ضارة/مخالفة للقانون (صور/صوت/فيديو غير لائقة)", 
                  en: "Uploading harmful, illegal or punishable media (images/voice/videos)" 
                },
                { 
                  id: "bad_language", 
                  ar: "استخدام لغة مؤذية، غير لائقة أو تشهير رقمي", 
                  en: "Using inappropriate, harmful language or harassment" 
                },
                { 
                  id: "platform_abuse", 
                  ar: "إساءة استخدام المنصة والإضرار بالصالح العام", 
                  en: "General platform abuse or malicious disruption" 
                }
              ].map(opt => (
                <label key={opt.id} style={{ display:"flex",alignItems:"flex-start",gap:"8px",cursor:"pointer",fontSize:"0.85rem",padding:"8px",background:"var(--bg-700)",borderRadius:"6px",border:"1px solid var(--border-subtle)" }}>
                  <input 
                    type="radio" 
                    name="exportReason" 
                    value={opt.id} 
                    checked={exportReason === opt.id}
                    onChange={() => setExportReason(opt.id)}
                    style={{ marginTop:"3px" }}
                  />
                  <span>{lang === "ar" ? opt.ar : opt.en}</span>
                </label>
              ))}
            </div>

            <div style={{ marginBottom:"20px" }}>
              <label style={{ display:"block",fontSize:"0.82rem",color:"var(--tx-2)",marginBottom:"6px" }}>
                {lang === "ar" ? "ملاحظات إضافية وتفاصيل المخالفة (اختياري):" : "Additional Admin Notes / Violation Context (Optional):"}
              </label>
              <textarea 
                rows="3"
                value={exportNotes}
                onChange={e => setExportNotes(e.target.value)}
                placeholder={lang === "ar" ? "أدخل أي تفاصيل أو سياق إضافي..." : "Enter any additional details..."}
                style={{ width:"100%",padding:"8px",background:"var(--bg-900)",border:"1px solid var(--border-subtle)",borderRadius:"6px",color:"var(--tx-1)",fontFamily:"inherit",fontSize:"0.85rem",boxSizing:"border-box",resize:"none" }}
              />
            </div>

            <div style={{ display:"flex",gap:"10px",justifyContent:"flex-end" }}>
              <button className="btn-ghost" onClick={()=>setExportTarget(null)} style={{ padding:"8px 16px" }}>
                {t.close}
              </button>
              <button 
                onClick={() => {
                  const opts = {
                    false_reports: lang === "ar" ? "تقديم بلاغات كاذبة أو عشوائية متكررة" : "Repeated spamming or submitting false reports",
                    harmful_media: lang === "ar" ? "إرفاق وسائط ضارة/مخالفة للقانون (صور/صوت/فيديو غير لائقة)" : "Uploading harmful, illegal or punishable media (images/voice/videos)",
                    bad_language: lang === "ar" ? "استخدام لغة مؤذية، غير لائقة أو تشهير رقمي" : "Using inappropriate, harmful language or harassment",
                    platform_abuse: lang === "ar" ? "إساءة استخدام المنصة والإضرار بالصالح العام" : "General platform abuse or malicious disruption"
                  };
                  const selectedReasonText = opts[exportReason] || (lang === "ar" ? "إساءة استخدام المنصة" : "Platform Abuse");
                  exportPoliceReport(exportTarget, selectedReasonText, exportNotes);
                  setExportTarget(null);
                }} 
                style={{ padding:"8px 16px",background:"var(--gold-400)",color:"#000",border:"none",borderRadius:"6px",fontWeight:600,cursor:"pointer" }}
              >
                {lang === "ar" ? "إصدار وتصدير" : "Generate & Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
