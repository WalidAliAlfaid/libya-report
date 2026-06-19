import React, { useState, useEffect } from "react";
import { strings } from "./locales/strings";
import { dbService } from "./services/db";
import MapComponent from "./components/MapComponent";
import ReportModal from "./components/ReportModal";
import Profile from "./components/Profile";
import AdminPortal from "./components/AdminPortal";
import NotificationToast, { showToast } from "./components/NotificationToast";
import HotlinesModal from "./components/HotlinesModal";
import { Geolocation } from "@capacitor/geolocation";
import { Device } from "@capacitor/device";
import { notificationService } from "./services/notifications";
import AppLogo from "./components/AppLogo";
import ChatComponent from "./components/ChatComponent";
import LandingPage from "./components/LandingPage";
import { registerPlugin } from "@capacitor/core";

let OfflineChat = null;
try {
  OfflineChat = registerPlugin("OfflineChat");
} catch (e) {}

const GATEWAY_SMS_NUMBER = "+218915900126"; // Gateway phone number configured for SMS reports

// Icons (inline SVG to avoid lucide class name conflicts)
const IconMap    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
const IconChat   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconUser   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0112 0v1"/></svg>;
const IconShield = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l7 3v5c0 5-3.5 9.74-7 11-3.5-1.26-7-6-7-11V5l7-3z"/></svg>;
const IconGlobe  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>;
const IconPlus   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>;
const IconX      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>;

export default function App() {
  // Show landing page first; dismissed by clicking "Use Web Version"
  const [showLanding, setShowLanding] = useState(true);

  const [lang, setLang]       = useState("ar");
  const [activeTab, setActiveTab] = useState("map"); // "map" | "profile" | "chat"
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [reports, setReports] = useState([]);
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem("libya_report_map_style") || "voyager");
  const [userCoords, setUserCoords] = useState(null);

  const fetchAndSetUserCoords = async () => {
    try {
      const pos = await getUserLocation();
      setUserCoords(pos);
      return pos;
    } catch (err) {
      console.log("Error getting user location:", err);
    }
  };

  const [placementCat, setPlacementCat] = useState(null);
  const [reportCoords, setReportCoords] = useState(null);
  const [showModal, setShowModal]       = useState(false);

  const [watchAreas, setWatchAreas]     = useState([]);
  const [drawingWatch, setDrawingWatch] = useState(false);

  const [showAdmin, setShowAdmin] = useState(false);
  const [showHotlines, setShowHotlines] = useState(false);
  const [isOnline, setIsOnline]   = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [unresolvedPromptReport, setUnresolvedPromptReport] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const processSMSReportOrChat = (sender, body) => {
    if (body.startsWith("LBREPORT:")) {
      try {
        const payload = body.substring(9);
        const parts = payload.split("|");
        if (parts.length >= 4) {
          const category = parts[0];
          const lat = parseFloat(parts[1]);
          const lng = parseFloat(parts[2]);
          const description = parts.slice(3).join("|");
          
          const peerReport = {
            id: "rep_sms_" + Math.random().toString(36).substr(2, 9),
            ticketCode: Math.floor(100000 + Math.random() * 900000).toString(),
            deviceId: "sms_gateway_" + sender.replace(/\+/g, ''),
            hardwareId: "SMS_GATEWAY_RECEIVER",
            category,
            description,
            lat,
            lng,
            status: "Reported",
            timestamp: Date.now(),
            upvotes: 0,
            upvotedDevices: []
          };
          
          dbService.addPeerReport(peerReport).then(added => {
            if (added) {
              showToast(lang === "en" ? `SMS report received from ${sender}!` : `تم استلام بلاغ رسالة قصيرة من ${sender}!`, "success");
            }
          });
        }
      } catch (e) {
        console.error("Failed to parse SMS report", e);
      }
    } else if (body.startsWith("LBMSG:")) {
      try {
        const payload = body.substring(6);
        const parts = payload.split("|");
        if (parts.length >= 3) {
          const room = parts[0];
          const senderName = parts[1];
          const text = parts.slice(2).join("|");
          
          const peerMsg = {
            id: "msg_sms_" + Math.random().toString(36).substr(2, 9),
            room,
            sender: senderName,
            text,
            role: "anonymousUser",
            timestamp: Date.now(),
            lat: null,
            lng: null
          };
          
          dbService.addPeerChatMessage(peerMsg).then(added => {
            if (added) {
              showToast(lang === "en" ? `SMS chat message received from ${senderName}!` : `تم استلام رسالة دردشة قصيرة من ${senderName}!`, "success");
            }
          });
        }
      } catch(e) {
        console.error("Failed to parse SMS chat message", e);
      }
    }
  };

  const t = strings[lang];

  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (unresolvedPromptReport) return;

      const myId = localStorage.getItem("libya_report_device_id");
      if (!myId) return;

      const allReports = dbService.getReports();
      const prompted = JSON.parse(localStorage.getItem("libya_report_prompted_ids") || "[]");

      // Find an unsolved report by this user that is older than 2 hours and hasn't been prompted yet
      const target = allReports.find(r => 
        r.deviceId === myId && 
        r.status !== "Resolved" && 
        (Date.now() - r.timestamp) > 2 * 3600 * 1000 &&
        !prompted.includes(r.id)
      );

      if (target) {
        setUnresolvedPromptReport(target);
      }
    }, 15000);

    return () => clearInterval(checkInterval);
  }, [reports, unresolvedPromptReport]);

  useEffect(() => {
    const fetchId = async () => {
      try {
        const info = await Device.getId();
        if (info && info.identifier) {
          localStorage.setItem("libya_report_hardware_id", info.identifier);
        }
      } catch (err) {
        console.error("Device getId error:", err);
      }
    };
    fetchId();
    fetchAndSetUserCoords();

    setIsAdmin(localStorage.getItem("libya_report_is_admin") === "true");
    setQueueCount(dbService.getQueueCount());
    const w = localStorage.getItem("libya_report_watch_areas");
    if (w) setWatchAreas(JSON.parse(w));

    let unsubscribe;
    const isConfig = dbService.isConfigured();

    if (isConfig) {
      unsubscribe = dbService.subscribeReports((data) => {
        setReports(data);
      });
    } else {
      setReports(dbService.getReports());
    }

    const handleNew = () => {
      if (!isConfig) setReports(dbService.getReports());
    };

    window.addEventListener("libya_report_new", handleNew);
    window.addEventListener("libya_report_synced", handleNew);

    const goOnline = async () => {
      setIsOnline(true);
      const n = await dbService.syncQueue();
      if (n > 0) {
        showToast(t.syncComplete, "success");
        setReports(dbService.getReports());
        setQueueCount(0);
      }
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);

    // Native SMS integration
    let smsListener = null;
    const checkSMS = async () => {
      if (OfflineChat) {
        try {
          const res = await OfflineChat.getPendingSMS();
          if (res && res.smsList) {
            res.smsList.forEach(sms => processSMSReportOrChat(sms.sender, sms.body));
          }
        } catch (e) {
          console.log("Error checking pending SMS:", e);
        }
      }
    };
    checkSMS();

    const registerSMS = async () => {
      if (OfflineChat) {
        try {
          smsListener = await OfflineChat.addListener("onSMSReceived", (data) => {
            processSMSReportOrChat(data.sender, data.body);
          });
        } catch(e) {
          console.log("Failed to register native SMS listener", e);
        }
      }
    };
    registerSMS();

    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("libya_report_new", handleNew);
      window.removeEventListener("libya_report_synced", handleNew);
      if (smsListener) smsListener.remove();
      if (unsubscribe) unsubscribe();
    };
  }, [lang]);


  const dist = (la1,lo1,la2,lo2) => {
    const R=6371e3, p1=la1*Math.PI/180, p2=la2*Math.PI/180;
    const dp=(la2-la1)*Math.PI/180, dl=(lo2-lo1)*Math.PI/180;
    const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  };

  const handleMapClick = (lat, lng) => {
    if (drawingWatch) {
      const nw = { id:"w_"+Math.random().toString(36).substr(2,8), lat, lng, radius:5000 };
      const next = [...watchAreas, nw];
      setWatchAreas(next);
      localStorage.setItem("libya_report_watch_areas", JSON.stringify(next));
      setDrawingWatch(false);
      showToast(lang==="en"?"Watch area created!":"تم إنشاء منطقة المتابعة!", "success");
      return;
    }
    if (placementCat) { setReportCoords({ lat, lng }); setShowModal(true); }
  };

  const getUserLocation = async () => {
    try {
      try {
        await Geolocation.requestPermissions();
      } catch (e) {
        console.log("Location permission request failed", e);
      }
      try {
        const lastPos = await Geolocation.getLastKnownPosition();
        if (lastPos && lastPos.timestamp && (Date.now() - lastPos.timestamp < 120000)) {
          return { lat: lastPos.coords.latitude, lng: lastPos.coords.longitude };
        }
      } catch (e) {
        console.log("Failed to get last known position", e);
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err) {
      throw err;
    }
  };

  const handleSubmit = async (data) => {
    try {
      const checkProximity = !isAdmin;
      
      if (checkProximity) {
        showToast(lang === "en" ? "Verifying your location..." : "جاري التحقق من موقعك...", "info");
        let userPos;
        try {
          userPos = await getUserLocation();
        } catch (err) {
          showToast(t.locationRequired, "error");
          return;
        }

        const distance = dist(userPos.lat, userPos.lng, data.lat, data.lng);
        if (distance > 10000) {
          showToast(t.tooFarError, "error");
          return;
        }
      }

      // Fetch IP & ISP details
      let netInfo = { ip: "Unknown IP", isp: "Unknown ISP" };
      try {
        const netRes = await fetch("https://ipapi.co/json/");
        if (netRes.ok) {
          const netData = await netRes.json();
          netInfo = { ip: netData.ip || "Unknown IP", isp: netData.org || "Unknown ISP" };
        }
      } catch (err) {
        console.log("Failed fetching network details", err);
      }

      const reportPayload = {
        ...data,
        hardwareId: localStorage.getItem("libya_report_hardware_id") || "WEB_FALLBACK",
        ipAddress: netInfo.ip,
        ispProvider: netInfo.isp
      };

      const res = await dbService.submitReport(reportPayload);
      
      // Schedule background verification notification (legit local notification trigger in 2 hours)
      const catName = t[data.category] || data.category;
      notificationService.scheduleStatusCheck(res.id || data.id || Math.random().toString(), catName, 2, lang);

      if (res.status === "queued") {
        showToast(t.offlineMode, "warning");
        setQueueCount(dbService.getQueueCount());
        
        // Broadcast the report over the mesh network
        const payloadStr = "__REPORT__:" + JSON.stringify(res.report);
        if (OfflineChat) {
          try {
            await OfflineChat.sendMeshMessage({
              text: payloadStr,
              sender: "System",
              lat: data.lat,
              lng: data.lng
            });
          } catch(err) {
            console.log("Failed to broadcast report over native mesh", err);
          }
        } else {
          showToast(lang === "en" ? "Report queued and broadcasted via simulated mesh!" : "تم حفظ البلاغ محلياً وبثه عبر محاكي الشبكة المباشرة!", "info");
        }

        // Prompt user to send SMS to Gateway Phone Number
        setTimeout(() => {
          const confirmSMS = window.confirm(
            lang === "en" 
              ? `You are offline. Would you like to dispatch a backup SMS of this report to our Gateway number (${GATEWAY_SMS_NUMBER})?`
              : `أنت غير متصل بالإنترنت. هل ترغب في إرسال بلاغ احتياطي عبر الرسائل النصية القصيرة (SMS) إلى رقم بوابة الاستقبال (${GATEWAY_SMS_NUMBER})؟`
          );
          if (confirmSMS) {
            const smsText = `LBREPORT:${data.category}|${data.lat.toFixed(5)}|${data.lng.toFixed(5)}|${data.description}`;
            window.open(`sms:${GATEWAY_SMS_NUMBER}?body=${encodeURIComponent(smsText)}`);
          }
        }, 1200);
      } else {
        showToast(lang==="en"?"Report submitted successfully!":"تم إرسال البلاغ بنجاح!", "success");
        setReports(dbService.getReports());
        watchAreas.forEach(w => { if (dist(w.lat,w.lng,data.lat,data.lng) <= w.radius) showToast(t.highPriorityAlert,"warning"); });
      }
    } catch(e) {
      if (e.message==="BLACKLISTED") showToast(t.blacklistedError,"error");
      else if (e.message.startsWith("COOLDOWN:")) showToast(t.cooldownError,"error");
      else showToast(e.message,"error");
    } finally {
      setShowModal(false); setPlacementCat(null);
    }
  };

  const openDrawer = () => { setActiveTab("map"); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setActiveTab("map"); };

  const handleCatSelect = (cat) => {
    setPlacementCat(cat);
    setDrawerOpen(false);
    showToast(t.placementMode, "info");
  };

  const CATS = [
    { key:"electricity", emoji:"⚡", name_en:"Electricity",  name_ar:"انقطاع كهرباء", desc_en:"Power outage",      desc_ar:"انقطاع التيار الكهربائي", bg:"rgba(212,168,83,0.15)",  clr:"#d4a853" },
    { key:"flooding",    emoji:"🌊", name_en:"Flooding",     name_ar:"طريق مغمور",   desc_en:"Road flooding",       desc_ar:"طرق مغمورة بالمياه",      bg:"rgba(59,130,246,0.15)", clr:"#3b82f6" },
    { key:"streetlight", emoji:"💡", name_en:"Streetlight",  name_ar:"إضاءة معطلة", desc_en:"Broken streetlight",  desc_ar:"إنارة معطلة",             bg:"rgba(234,179,8,0.15)",  clr:"#eab308" },
    { key:"waterLeak",   emoji:"💧", name_en:"Water Leak",   name_ar:"تسريب مياه",   desc_en:"Pipe leak or break",  desc_ar:"تسريب أو كسر في الأنابيب",bg:"rgba(6,182,212,0.15)",  clr:"#06b6d4" },
    { key:"other",       emoji:"⚠️", name_en:"Other Issue",  name_ar:"مشكلة أخرى",  desc_en:"Any civic issue",     desc_ar:"أي مشكلة خدمية أخرى",    bg:"rgba(139,92,246,0.15)", clr:"#8b5cf6" },
  ];

  // ── Show landing page before the main app ──
  if (showLanding) {
    return <LandingPage onEnterApp={() => setShowLanding(false)} />;
  }

  return (
    <div className="shell" dir={t.direction}>

      {/* ── FULL-SCREEN MAP ── */}
      <div className="map-layer">
        <MapComponent
          lang={lang} reports={reports}
          placementCategory={placementCat}
          onMapClick={handleMapClick}
          watchAreas={watchAreas}
          isDrawingWatch={drawingWatch}
          setIsDrawingWatch={setDrawingWatch}
          isAdmin={isAdmin}
          style={mapStyle}
          setStyle={(newStyle) => {
            setMapStyle(newStyle);
            localStorage.setItem("libya_report_map_style", newStyle);
          }}
        />
      </div>

      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-mark">
            <AppLogo size={32} />
          </div>
          <div className="brand-text">
            <span className="brand-title">{t.title}</span>
            <span className="brand-sub">{lang==="en"?"Civic Reporting Platform":"منصة التبليغ المدني"}</span>
          </div>
        </div>

        <div className="header-right">
          <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 10px", borderRadius:"var(--r-pill)", background:"rgba(255,255,255,0.04)", border:"1px solid var(--border-subtle)" }}>
            <div className={`online-dot ${isOnline ? "" : "offline-dot"}`} />
            <span style={{ fontSize:"0.72rem", fontWeight:600, color: isOnline?"var(--clr-green)":"var(--clr-red)" }}>
              {isOnline ? (lang==="en"?"Live":"مباشر") : (lang==="en"?"Offline":"غير متصل")}
            </span>
          </div>


          <button className="hbtn" onClick={() => setShowHotlines(true)} style={{ borderColor: "rgba(245,158,11,0.25)", color: "var(--clr-amber)" }}>
            <span>📞</span>
            {lang === "en" ? "SOS" : "طوارئ"}
          </button>
        </div>
      </header>

      {/* ── PLACEMENT BANNER ── */}
      {placementCat && !showModal && (
        <div className="placement-banner">
          <span style={{ fontSize:"1.1rem" }}>{CATS.find(c=>c.key===placementCat)?.emoji}</span>
          <span>{lang==="en"?"Tap on the map to place the report":"انقر على الخريطة لتحديد موقع البلاغ"}</span>
          <button className="cancel-chip" onClick={() => setPlacementCat(null)}>
            {lang==="en"?"Cancel":"إلغاء"}
          </button>
        </div>
      )}

      {/* ── DRAWER SCRIM ── */}
      {drawerOpen && <div className="drawer-scrim" onClick={closeDrawer} />}

      {/* ── REPORT CATEGORY DRAWER ── */}
      {drawerOpen && activeTab === "map" && (
        <div className="drawer">
          <div className="drawer-handle" />
          <div className="drawer-header">
            <span className="drawer-title">{lang==="en"?"What's the issue?":"ما هي المشكلة؟"}</span>
            <button className="drawer-close" onClick={closeDrawer}><IconX /></button>
          </div>
          {queueCount > 0 && (
            <div style={{ margin:"0 18px 14px", padding:"11px 14px", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:"var(--r-md)", fontSize:"0.8rem", color:"var(--clr-amber)", fontWeight:600 }}>
              ⏳ {lang==="en" ? `${queueCount} queued reports will sync when online.` : `${queueCount} بلاغات معلقة ستتزامن عند الاتصال.`}
            </div>
          )}
          <div className="drawer-body">
            <div className="cat-grid">
              {CATS.filter(c => c.key !== "other").map(c => (
                <div
                  key={c.key}
                  className="cat-tile"
                  style={{ "--tile-accent": c.bg }}
                  onClick={() => handleCatSelect(c.key)}
                >
                  <div className="cat-icon-box" style={{ background: c.bg }}>
                    {c.emoji}
                  </div>
                  <div className="cat-info">
                    <span className="cat-name">{lang==="en"?c.name_en:c.name_ar}</span>
                    <span className="cat-desc">{lang==="en"?c.desc_en:c.desc_ar}</span>
                  </div>
                </div>
              ))}
              {/* Other spans full width */}
              {CATS.filter(c => c.key === "other").map(c => (
                <div
                  key={c.key}
                  className="cat-tile wide"
                  style={{ "--tile-accent": c.bg }}
                  onClick={() => handleCatSelect(c.key)}
                >
                  <div className="cat-icon-box" style={{ background: c.bg }}>
                    {c.emoji}
                  </div>
                  <div className="cat-info">
                    <span className="cat-name">{lang==="en"?c.name_en:c.name_ar}</span>
                    <span className="cat-desc">{lang==="en"?c.desc_en:c.desc_ar}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT DRAWER ── */}
      {drawerOpen && activeTab === "chat" && (
        <div className="drawer">
          <div className="drawer-handle" />
          <div className="drawer-header">
            <span className="drawer-title">{lang==="en"?"Community Chat":"الدردشة المجتمعية"}</span>
            <button className="drawer-close" onClick={closeDrawer}><IconX /></button>
          </div>
          <div className="drawer-body" style={{ padding: 0, overflow: "hidden" }}>
            <ChatComponent
              lang={lang}
              userCoords={userCoords}
              requestUserLocation={fetchAndSetUserCoords}
            />
          </div>
        </div>
      )}

      {/* ── PROFILE DRAWER ── */}
      {drawerOpen && activeTab === "profile" && (
        <div className="drawer">
          <div className="drawer-handle" />
          <div className="drawer-header">
            <span className="drawer-title">{lang==="en"?"My Profile":"ملفي الشخصي"}</span>
            <button className="drawer-close" onClick={closeDrawer}><IconX /></button>
          </div>
          <div className="drawer-body">
            <Profile
              lang={lang}
              watchAreas={watchAreas}
              setWatchAreas={setWatchAreas}
              startWatchDrawing={() => {
                setDrawingWatch(true);
                setDrawerOpen(false);
                showToast(lang==="en"?"Tap on map to define watch center":"انقر على الخريطة لتحديد مركز المتابعة","info");
              }}
              onAdminClick={() => {
                setShowAdmin(true);
                setDrawerOpen(false);
              }}
              mapStyle={mapStyle}
              setMapStyle={(newStyle) => {
                setMapStyle(newStyle);
                localStorage.setItem("libya_report_map_style", newStyle);
              }}
              setLang={setLang}
            />
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <nav className="bottom-nav">
        {/* Chat Tab */}
        <button
          className={`nav-item ${activeTab==="chat"&&drawerOpen?"active":""}`}
          onClick={() => {
            if (activeTab === "chat" && drawerOpen) {
              closeDrawer();
            } else {
              setActiveTab("chat");
              setDrawerOpen(true);
            }
          }}
        >
          <IconChat />
          {lang==="en"?"Chat":"الدردشة"}
        </button>

        {/* Center FAB */}
        <div className="nav-fab-wrapper">
          <button
            className={`nav-fab ${placementCat ? "cancel" : ""}`}
            onClick={() => {
              if (placementCat) { setPlacementCat(null); return; }
              setActiveTab("map");
              setDrawerOpen(d => !d);
            }}
          >
            {placementCat ? <IconX /> : <IconPlus />}
            {queueCount > 0 && !placementCat && <span className="fab-badge">{queueCount}</span>}
          </button>
        </div>

        {/* Profile Tab */}
        <button
          className={`nav-item ${activeTab==="profile"&&drawerOpen?"active":""}`}
          onClick={() => { setActiveTab("profile"); setDrawerOpen(true); }}
        >
          <IconUser />
          {lang==="en"?"Profile":"ملفي"}
        </button>
      </nav>

      {/* ── REPORT FORM ── */}
      {showModal && (
        <ReportModal
          lang={lang} category={placementCat} coords={reportCoords}
          onClose={() => { setShowModal(false); setPlacementCat(null); }}
          onSubmit={handleSubmit}
        />
      )}

      {/* ── ADMIN ── */}
      {showAdmin && (
        <AdminPortal
          lang={lang} reports={reports}
          setReports={setReports}
          onClose={() => setShowAdmin(false)}
          onLoginSuccess={() => setIsAdmin(true)}
          onLogout={() => setIsAdmin(false)}
        />
      )}

      {/* ── EMERGENCY HOTLINES ── */}
      {showHotlines && (
        <HotlinesModal
          lang={lang}
          onClose={() => setShowHotlines(false)}
        />
      )}

      {/* ── UNRESOLVED REPORT PROMPT MODAL ── */}
      {unresolvedPromptReport && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 800,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-800)",
            border: "1px solid var(--border-gold)",
            borderRadius: "var(--r-xl)",
            padding: "24px",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
            boxShadow: "var(--shadow-gold)",
            position: "relative"
          }}>
            <div style={{
              position: "absolute",
              top: "-15px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--clr-red)",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: "var(--r-pill)",
              fontSize: "0.75rem",
              fontWeight: "bold"
            }}>
              {lang === "en" ? "Action Required!" : "مطلوب إجراء!"}
            </div>

            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⏱️</div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--tx-1)", marginBottom: "8px" }}>
              {lang === "en" ? "Is this report solved?" : "هل تم حل هذا البلاغ؟"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--tx-2)", lineHeight: 1.5, marginBottom: "20px" }}>
              {lang === "en" 
                ? `Your report about "${t[unresolvedPromptReport.category] || unresolvedPromptReport.category}" was submitted earlier. Please update its status. Ignoring this will reduce your merit score.`
                : `تم تقديم بلاغك الخاص بـ "${t[unresolvedPromptReport.category] || unresolvedPromptReport.category}" سابقاً. يرجى تحديث الحالة. تجاهل هذا سيقلل من نقاطك.`}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                className="btn-submit"
                style={{ background: "var(--clr-green)", borderColor: "var(--clr-green)", color: "#fff" }}
                onClick={() => {
                  dbService.updateReportStatus(unresolvedPromptReport.id, "Resolved");
                  const prompted = JSON.parse(localStorage.getItem("libya_report_prompted_ids") || "[]");
                  prompted.push(unresolvedPromptReport.id);
                  localStorage.setItem("libya_report_prompted_ids", JSON.stringify(prompted));
                  
                  setReports(dbService.getReports());
                  setUnresolvedPromptReport(null);
                  showToast(lang === "en" ? "Thank you! Status updated to Resolved." : "شكراً لك! تم تحديث الحالة إلى تم الحل.", "success");
                }}
              >
                ✅ {lang === "en" ? "Yes, it is solved" : "نعم، تم حل المشكلة"}
              </button>

              <button
                className="btn-submit"
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "var(--border-subtle)", color: "var(--tx-1)" }}
                onClick={() => {
                  const prompted = JSON.parse(localStorage.getItem("libya_report_prompted_ids") || "[]");
                  prompted.push(unresolvedPromptReport.id);
                  localStorage.setItem("libya_report_prompted_ids", JSON.stringify(prompted));
                  
                  setUnresolvedPromptReport(null);
                  showToast(lang === "en" ? "Thank you for the update. We will keep it open." : "شكراً للتحديث. سنبقي البلاغ مفتوحاً.", "info");
                }}
              >
                ❌ {lang === "en" ? "No, it is not solved" : "لا، لم تُحل بعد"}
              </button>

              <button
                className="btn-submit"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "var(--tx-2)" }}
                onClick={() => {
                  const prompted = JSON.parse(localStorage.getItem("libya_report_prompted_ids") || "[]");
                  prompted.push(unresolvedPromptReport.id);
                  localStorage.setItem("libya_report_prompted_ids", JSON.stringify(prompted));
                  
                  setUnresolvedPromptReport(null);
                  showToast(lang === "en" ? "Notifying nearby users to review..." : "جاري إرسال تنبيه للمستخدمين القريبين للمراجعة...", "warning");
                }}
              >
                📢 {lang === "en" ? "No, notify nearby users" : "لا، نبه المستخدمين القريبين"}
              </button>

              <button
                style={{
                  background: "rgba(244,63,94,0.08)",
                  border: "1px solid rgba(244,63,94,0.2)",
                  color: "var(--clr-red)",
                  padding: "10px",
                  borderRadius: "var(--r-md)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
                onClick={() => {
                  const prompted = JSON.parse(localStorage.getItem("libya_report_prompted_ids") || "[]");
                  prompted.push(unresolvedPromptReport.id);
                  localStorage.setItem("libya_report_prompted_ids", JSON.stringify(prompted));

                  const currentPenalty = parseInt(localStorage.getItem("libya_report_merit_penalty") || "0", 10);
                  localStorage.setItem("libya_report_merit_penalty", (currentPenalty + 10).toString());

                  window.dispatchEvent(new CustomEvent("libya_report_new"));

                  setUnresolvedPromptReport(null);
                  showToast(lang === "en" ? "Ignored. Merit penalty applied (-10 pts)." : "تم التجاهل. تم تطبيق عقوبة خصم نقاط (-10 نقاط).", "error");
                }}
              >
                ⚠️ {lang === "en" ? "Ignore (Lose 10 Points)" : "تجاهل (خصم 10 نقاط)"}
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationToast />
    </div>
  );
}
