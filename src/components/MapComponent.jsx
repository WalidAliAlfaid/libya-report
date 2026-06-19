import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDeviceFingerprint } from "../services/fingerprint";
import { dbService } from "../services/db";
import { showToast } from "./NotificationToast";
import { Geolocation } from "@capacitor/geolocation";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || "6hPlcNbZN0yp20GXN9KB";

const TILE_STYLES = {
  voyager: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  detailed: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/outdoor-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  esri_streets: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  esri_topo: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
};

const TRANSLATIONS = {
  ar: {
    electricity: "انقطاع الكهرباء",
    flooding: "فيضانات وسيول",
    streetlight: "إنارة تالفة",
    waterLeak: "تسرب مياه",
    other: "مشكلة أخرى",
    Reported: "تم التبليغ",
    "In Progress": "قيد المعالجة",
    Resolved: "تم الحل",
    meToo: "أنا أيضاً",
    meTooActive: "أبلغت عن هذا",
    shareWhatsApp: "مشاركة",
  },
  en: {
    electricity: "Electricity Outage",
    flooding: "Flooding & Drainage",
    streetlight: "Broken Streetlight",
    waterLeak: "Water Leak",
    other: "Other Issue",
    Reported: "Reported",
    "In Progress": "In Progress",
    Resolved: "Resolved",
    meToo: "Me Too",
    meTooActive: "Reported by You",
    shareWhatsApp: "Share",
  }
};

const DESC_TRANSLATIONS = {
  "Power grid failure in Tripoli, Al-Dahra district. Outage lasting 4+ hours.": 
    "عطل في شبكة الكهرباء في طرابلس، منطقة الظهرة. انقطاع دام لأكثر من 4 ساعات.",
  "Flooding on Ring Road 2 in Tripoli due to heavy rain. Drainage completely blocked.": 
    "فيضان في الطريق الدائري الثاني في طرابلس بسبب الأمطار الغزيرة. انسداد كامل للمصارف.",
  "Major water pipe leak in Benghazi, Al-Hadaeq district. Water flooding the street.": 
    "تسرب كبير في أنبوب المياه في بنغازي، حي الحدائق. المياه تغمر الشارع.",
  "Broken streetlights along Misrata central avenue. Zero visibility at night.": 
    "أعمدة إنارة مكسورة على طول الشارع الرئيسي في مصراتة. الرؤية معدومة ليلاً.",
  "Transformer explosion in Sebha, Al-Manshiya district. Sparks and fire reported.": 
    "انفجار محول كهربائي في سبها، حي المنشية. تم الإبلاغ عن شرارات وحريق.",
  "Garbage blocking footpaths in Khoms near historical ruins. Public hazard.": 
    "القمامة تسد ممرات المشاة في الخمس بالقرب من الآثار التاريخية. خطر عام."
};

const CAT_COLOR = {
  electricity: "#d4a853",
  flooding:    "#3b82f6",
  streetlight: "#eab308",
  waterLeak:   "#06b6d4",
  other:       "#8b5cf6",
};

const CAT_EMOJI = {
  electricity: "⚡",
  flooding:    "🌊",
  streetlight: "💡",
  waterLeak:   "💧",
  other:       "⚠️",
};

const ATTRIBUTION = MAPTILER_KEY 
  ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Build a clean SVG+HTML marker that Leaflet renders as a proper teardrop pin.
 * IMPORTANT: No CSS transform on the inner element — iconAnchor handles positioning.
 */
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

/**
 * Build a clean SVG+HTML marker that Leaflet renders as a proper teardrop pin.
 * IMPORTANT: No CSS transform on the inner element — iconAnchor handles positioning.
 */
function buildMarkerIcon(category, opacity = 1, upvotes = 0, isResolved = false, timestamp = null) {
  const color = isResolved ? "#22c55e" : (CAT_COLOR[category] || "#8b5cf6");
  const emoji = isResolved ? "✅" : (CAT_EMOJI[category] || "⚠️");

  const elapsedHours = timestamp ? (Date.now() - timestamp) / (3600 * 1000) : 0;
  
  const isHighSeverity = !isResolved && (upvotes > 5 || elapsedHours >= 72);
  const isMediumSeverity = !isResolved && (!isHighSeverity && (upvotes >= 2 || elapsedHours >= 24));

  let scale = 1;
  let borderOverride = null;

  if (isHighSeverity) {
    scale = 1.25; // 25% larger
    borderOverride = "#f43f5e"; // Crimson border
  } else if (isMediumSeverity) {
    scale = 1.12; // 12% larger
    borderOverride = "#eab308"; // Amber border
  }

  const W = Math.round(40 * scale);
  const H = Math.round(52 * scale);
  const bubbleSize = Math.round(40 * scale);
  const tailHeight = Math.round(12 * scale);
  const tailWidth = Math.round(7 * scale);
  
  const ringColor = isHighSeverity ? "var(--clr-red)" : (isMediumSeverity ? "var(--clr-amber)" : null);
  const ringBg = isHighSeverity ? "rgba(244,63,94,0.18)" : (isMediumSeverity ? "rgba(245,158,11,0.12)" : null);

  const html = `
    <div style="
      width: ${W}px;
      height: ${H}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      opacity: ${opacity};
      position: relative;
    ">
      ${ringColor ? `
        <!-- Pulsing background glow ring for high severity/age warning -->
        <div style="
          position: absolute;
          top: -${Math.round(6 * scale)}px;
          left: -${Math.round(6 * scale)}px;
          width: ${Math.round(52 * scale)}px;
          height: ${Math.round(52 * scale)}px;
          border-radius: 50%;
          background: ${ringBg};
          border: 2px solid ${ringColor};
          animation: lr-pulse 1.2s infinite alternate;
          z-index: -1;
        "></div>
      ` : ""}
      <!-- Bubble -->
      <div style="
        width: ${bubbleSize}px;
        height: ${bubbleSize}px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid ${borderOverride || "rgba(255,255,255,0.95)"};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${Math.round(18 * scale)}px;
        box-shadow: 0 3px 14px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3);
        flex-shrink: 0;
        line-height: 1;
      ">${emoji}</div>
      <!-- Tail triangle -->
      <div style="
        width: 0;
        height: 0;
        border-left: ${tailWidth}px solid transparent;
        border-right: ${tailWidth}px solid transparent;
        border-top: ${tailHeight}px solid ${color};
        filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));
        flex-shrink: 0;
      "></div>
    </div>
  `;

  return L.divIcon({
    className: "",        // ← no extra class that adds background/border
    html,
    iconSize:   [W, H],
    iconAnchor: [W / 2, H], // anchor at the tip of the tail (bottom-center)
    popupAnchor:[0, -H],    // popup appears above the pin
  });
}

export default function MapComponent({
  lang, reports, placementCategory,
  onMapClick, watchAreas,
  isDrawingWatch, setIsDrawingWatch,
  isAdmin,
  style, setStyle,
}) {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const tileRef         = useRef(null);
  const markersRef      = useRef(null);
  const watchRef        = useRef(null);
  const ghostRef        = useRef(null);
  const proximityCircleRef = useRef(null);
  const [isLocating, setIsLocating] = useState(false);
  const userLocMarkerRef = useRef(null);
  const userLocCircleRef = useRef(null);

  useEffect(() => {
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; // meters
      const p1 = lat1 * Math.PI / 180;
      const p2 = lat2 * Math.PI / 180;
      const dp = (lat2 - lat1) * Math.PI / 180;
      const dl = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
                Math.cos(p1) * Math.cos(p2) *
                Math.sin(dl / 2) * Math.sin(dl / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    window.lrUpvote = async (id) => {
      const targetReport = reports.find(r => r.id === id);
      if (!targetReport) return;

      const myId = getDeviceFingerprint();
      const hasUpvoted = targetReport.upvotedDevices && targetReport.upvotedDevices.includes(myId);

      // Allow removing the upvote immediately without location checks
      if (hasUpvoted) {
        dbService.toggleUpvote(id, myId);
        return;
      }

      showToast(lang === "en" ? "Verifying proximity..." : "جاري التحقق من موقعك الحالي...", "info");

      try {
        let pos;
        try {
          const lastPos = await Geolocation.getLastKnownPosition();
          if (lastPos && lastPos.timestamp && (Date.now() - lastPos.timestamp < 120000)) {
            pos = lastPos;
          }
        } catch (e) {}

        if (!pos) {
          pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60000
          });
        }

        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const d = calculateDistance(userLat, userLng, targetReport.lat, targetReport.lng);

        if (d <= 10000) {
          showLocationOverlay(userLat, userLng, pos.coords.accuracy || 100, false);
          dbService.toggleUpvote(id, myId);
        } else {
          showToast(lang === "en" ? "You must be within 10km of the issue to perform this action." : "يجب أن تكون ضمن نطاق 10 كم من الموقع الجغرافي لتنفيذ هذا الإجراء.", "error");
        }
      } catch (err) {
        showToast(lang === "en" ? "Location access is required to verify proximity." : "يجب السماح بالوصول إلى الموقع الجغرافي للتحقق من المسافة.", "error");
      }
    };

    window.lrShareWhatsApp = (id) => {
      const targetReport = reports.find(r => r.id === id);
      if (!targetReport) return;

      const categoryName = TRANSLATIONS[lang]?.[targetReport.category] || targetReport.category;
      const statusName = TRANSLATIONS[lang]?.[targetReport.status] || targetReport.status;
      const description = targetReport.description || "";
      const mapLink = `https://www.openstreetmap.org/?mlat=${targetReport.lat}&mlon=${targetReport.lng}#map=16/${targetReport.lat}/${targetReport.lng}`;

      let msg = "";
      if (lang === "ar") {
        msg = `📢 *بلاغ خدمي جديد في تقرير ليبيا* 🗺️\n\n` +
              `📍 *التصنيف:* ${categoryName}\n` +
              `📊 *الحالة:* ${statusName}\n` +
              (description ? `📝 *الوصف:* ${description}\n` : "") +
              `🌐 *رابط الموقع:* ${mapLink}\n\n` +
              `🤝 ساعدنا في دعم هذا البلاغ في منطقتنا!`;
      } else {
        msg = `📢 *New Civic Report on Libya Report* 🗺️\n\n` +
              `📍 *Category:* ${categoryName}\n` +
              `📊 *Status:* ${statusName}\n` +
              (description ? `📝 *Description:* ${description}\n` : "") +
              `🌐 *Map Location:* ${mapLink}\n\n` +
              `🤝 Help us coordinate and support this report in our neighborhood!`;
      }

      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
    };

    window.lrDeleteReport = async (id) => {
      const confirmMsg = lang === "en" 
        ? "Are you sure you want to delete this report?" 
        : "هل أنت متأكد من أنك تريد حذف هذا البلاغ؟";
      if (!window.confirm(confirmMsg)) return;

      showToast(lang === "en" ? "Deleting report..." : "جاري حذف البلاغ...", "info");
      const success = await dbService.deleteReport(id);
      if (success) {
        showToast(lang === "en" ? "Report deleted successfully." : "تم حذف البلاغ بنجاح.", "success");
      } else {
        showToast(lang === "en" ? "Failed to delete report." : "فشل في حذف البلاغ.", "error");
      }
    };

    return () => {
      delete window.lrUpvote;
      delete window.lrShareWhatsApp;
      delete window.lrDeleteReport;
    };
  }, [reports, lang]);

  // ── Stable refs so event handlers always see latest values ──
  const placementCatRef  = useRef(placementCategory);
  const isDrawingWatchRef = useRef(isDrawingWatch);
  const onMapClickRef    = useRef(onMapClick);

  useEffect(() => { placementCatRef.current  = placementCategory; },  [placementCategory]);
  useEffect(() => { isDrawingWatchRef.current = isDrawingWatch; },    [isDrawingWatch]);
  useEffect(() => { onMapClickRef.current    = onMapClick; },         [onMapClick]);

  const locateTimeoutRef = useRef(null);

  const clearLocationOverlay = () => {
    if (userLocMarkerRef.current) {
      userLocMarkerRef.current.remove();
      userLocMarkerRef.current = null;
    }
    if (userLocCircleRef.current) {
      userLocCircleRef.current.remove();
      userLocCircleRef.current = null;
    }
    if (locateTimeoutRef.current) {
      clearTimeout(locateTimeoutRef.current);
      locateTimeoutRef.current = null;
    }
  };

  const showLocationOverlay = (lat, lng, accuracy, persist = false) => {
    clearLocationOverlay();
    if (!mapRef.current) return;

    userLocCircleRef.current = L.circle([lat, lng], {
      radius: accuracy || 100,
      color: "#06b6d4",
      fillColor: "#06b6d4",
      fillOpacity: 0.1,
      weight: 1.5,
      interactive: false
    }).addTo(mapRef.current);

    userLocMarkerRef.current = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#ffffff",
      fillColor: "#06b6d4",
      fillOpacity: 1,
      weight: 2,
      interactive: false
    }).addTo(mapRef.current);

    if (!persist) {
      locateTimeoutRef.current = setTimeout(() => {
        if (!placementCatRef.current) {
          clearLocationOverlay();
        }
      }, 10000);
    }
  };

  // ── Init map once ──────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [28.5, 17.0],   // centre of Libya
      zoom: 6,
      zoomControl: false,
      preferCanvas: false,
    });

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    tileRef.current    = L.tileLayer(TILE_STYLES.voyager, { attribution: ATTRIBUTION, subdomains: "abcd", maxZoom: 20 }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    watchRef.current   = L.layerGroup().addTo(map);
    mapRef.current     = map;



    // ── Click handler ──
    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      if (isDrawingWatchRef.current) {
        onMapClickRef.current(lat, lng);
        return;
      }
      if (placementCatRef.current) {
        onMapClickRef.current(lat, lng);
      }
    });

    // ── Ghost marker follows mouse ──
    map.on("mousemove", (e) => {
      const cat = placementCatRef.current;
      if (!cat) return;
      const { lat, lng } = e.latlng;
      const ghostIcon = buildMarkerIcon(cat, 0.65);
      if (!ghostRef.current) {
        ghostRef.current = L.marker([lat, lng], { icon: ghostIcon, interactive: false, zIndexOffset: 1000 }).addTo(map);
      } else {
        ghostRef.current.setIcon(ghostIcon);
        ghostRef.current.setLatLng([lat, lng]);
      }
    });

    // ── Popup open / close handlers to draw 10km proximity boundary ──
    map.on("popupopen", (e) => {
      const source = e.popup._source;
      if (source && source.getLatLng) {
        const latlng = source.getLatLng();
        if (proximityCircleRef.current) {
          proximityCircleRef.current.remove();
        }
        proximityCircleRef.current = L.circle(latlng, {
          radius: 10000,
          className: "leaflet-proximity-circle",
          interactive: false
        }).addTo(map);
      }
    });

    map.on("popupclose", () => {
      if (proximityCircleRef.current) {
        proximityCircleRef.current.remove();
        proximityCircleRef.current = null;
      }
    });

    // ── Auto locate on startup ──
    const autoLocate = async () => {
      try {
        setIsLocating(true);
        try {
          await Geolocation.requestPermissions();
        } catch (e) {
          console.log("Startup location permission request failed", e);
        }
        let pos;
        try {
          const lastPos = await Geolocation.getLastKnownPosition();
          if (lastPos && lastPos.timestamp && (Date.now() - lastPos.timestamp < 60000)) {
            pos = lastPos;
          }
        } catch (e) {}

        if (!pos) {
          pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60000
          });
        }

        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        map.flyTo([latitude, longitude], 13, { duration: 1.5 });

        showLocationOverlay(latitude, longitude, accuracy, false);
      } catch (err) {
        setIsLocating(false);
        console.log("Startup geolocation failed", err);
      }
    };
    autoLocate();

    return () => {
      clearLocationOverlay();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLocateUser = async () => {
    try {
      setIsLocating(true);
      try {
        await Geolocation.requestPermissions();
      } catch (e) {
        console.log("Locate user permission request failed", e);
      }
      let pos;
      try {
        const lastPos = await Geolocation.getLastKnownPosition();
        if (lastPos && lastPos.timestamp && (Date.now() - lastPos.timestamp < 30000)) {
          pos = lastPos;
        }
      } catch (e) {}

      if (!pos) {
        pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000
        });
      }

      setIsLocating(false);

      const { latitude, longitude, accuracy } = pos.coords;
      if (mapRef.current) {
        mapRef.current.flyTo([latitude, longitude], 14, { duration: 1.5 });
        showLocationOverlay(latitude, longitude, accuracy, false);
      }
    } catch (err) {
      setIsLocating(false);
      showToast(lang === "en" ? "Unable to retrieve your location." : "تعذر الحصول على موقعك الجغرافي.", "error");
    }
  };

  useEffect(() => {
    if (!placementCategory) {
      if (ghostRef.current && mapRef.current) {
        ghostRef.current.remove();
        ghostRef.current = null;
      }
      clearLocationOverlay();
    } else {
      const triggerPlacementLocate = async () => {
        try {
          await Geolocation.requestPermissions();
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
          if (mapRef.current && placementCategoryRef.current) {
            showLocationOverlay(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, true);
          }
        } catch (e) {
          console.log("Placement locate failed", e);
        }
      };
      triggerPlacementLocate();
    }
  }, [placementCategory]);

  // ── Switch tile style ──────────────────────────────────────
  useEffect(() => {
    if (tileRef.current) tileRef.current.setUrl(TILE_STYLES[style]);
  }, [style]);


  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    // Show active reports and resolved reports that were resolved within the last 24 hours
    const activeReports = reports.filter(r => {
      if (r.status !== "Resolved") return true;
      const solvedTime = r.resolvedAt || r.timestamp;
      return (Date.now() - solvedTime) < (24 * 3600 * 1000); // 24 hours retention
    });

    activeReports.forEach((r) => {
      const color = CAT_COLOR[r.category] || "#8b5cf6";
      const emoji = CAT_EMOJI[r.category] || "⚠️";
      const statusColor = r.status === "Resolved" ? "#22c55e"
                        : r.status === "In Progress" ? "#f59e0b"
                        : "#f43f5e";

      const icon = buildMarkerIcon(r.category, 1, r.upvotes || 0, r.status === "Resolved", r.timestamp);

      const displayCategory = TRANSLATIONS[lang]?.[r.category] || r.category;
      const displayDesc = lang === "ar" ? (DESC_TRANSLATIONS[r.description] || r.description) : r.description;
      const displayStatus = TRANSLATIONS[lang]?.[r.status] || r.status;
      const displayDate = new Date(r.timestamp).toLocaleDateString(
        lang === "ar" ? "ar-LY" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      );

      const isRtl = lang === "ar";
      const myId = getDeviceFingerprint();
      const hasUpvoted = r.upvotedDevices && r.upvotedDevices.includes(myId);
      const upvotesCount = r.upvotes || 0;
      const displayMeToo = TRANSLATIONS[lang]?.meToo || "Me Too";
      const displayMeTooActive = TRANSLATIONS[lang]?.meTooActive || "Reported by You";
      const displayShareWhatsApp = TRANSLATIONS[lang]?.shareWhatsApp || "Share";

      const popup = `
        <div style="
          font-family:'Inter',-apple-system,sans-serif;
          min-width:210px; padding:16px;
          background:#0d1322; color:#f1f5f9;
          border-radius:14px;
          direction: ${isRtl ? "rtl" : "ltr"};
          text-align: ${isRtl ? "right" : "left"};
        ">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-direction:row;">
            <div style="
              width:36px;height:36px;border-radius:10px;
              background:${color}22;
              display:flex;align-items:center;justify-content:center;
              font-size:1.2rem;flex-shrink:0;
            ">${emoji}</div>
            <div>
              <div style="font-weight:800;font-size:0.9rem;color:${color};text-transform:capitalize;">${displayCategory}</div>
              <div style="font-size:0.7rem;color:#475569;margin-top:2px;">
                ${displayDate} ${r.status !== "Resolved" ? `• <span style="color:var(--gold-400);font-weight:700;">${getElapsedString(r.timestamp, lang)}</span>` : ""}
              </div>
            </div>
          </div>
          ${displayDesc ? `<p style="font-size:0.82rem;color:#94a3b8;line-height:1.5;margin-bottom:12px;">${displayDesc}</p>` : ""}
          ${r.audio ? `<div style="margin-top:2px;margin-bottom:12px;"><audio src="${r.audio}" controls style="width:100%;height:30px;border-radius:6px;display:block;outline:none;"></audio></div>` : ""}
          ${r.video ? `<div style="margin-top:2px;margin-bottom:12px;"><video src="${r.video}" controls style="width:100%;max-height:120px;border-radius:6px;display:block;outline:none;background:#000;"></video></div>` : ""}
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap;width:100%;">
            <span style="
              display:inline-block;padding:3px 10px;border-radius:99px;
              font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:0.3px;
              background:${statusColor}20;color:${statusColor};
            ">${displayStatus}</span>
            <div style="display:flex;gap:6px;align-items:center;">
              <button onclick="window.lrUpvote('${r.id}')" style="
                display:inline-flex;align-items:center;gap:4px;
                padding:4px 9px;border-radius:99px;
                border:1px solid ${hasUpvoted ? "var(--gold-400)" : "rgba(255,255,255,0.08)"};
                background:${hasUpvoted ? "var(--gold-400)" : "rgba(255,255,255,0.02)"};
                color:${hasUpvoted ? "#1a0900" : "var(--tx-2)"};
                font-size:0.68rem;font-weight:700;cursor:pointer;
                font-family:inherit;transition:all 0.15s ease;
              ">
                <span>👍</span>
                <span>${hasUpvoted ? displayMeTooActive : displayMeToo}</span>
                ${upvotesCount > 0 ? `<span style="font-size:0.62rem;opacity:0.8;">(${upvotesCount})</span>` : ""}
              </button>
              <button onclick="window.lrShareWhatsApp('${r.id}')" style="
                display:inline-flex;align-items:center;gap:4px;
                padding:4px 9px;border-radius:99px;
                border:1px solid rgba(34,197,94,0.3);
                background:rgba(34,197,94,0.08);
                color:var(--clr-green);
                font-size:0.68rem;font-weight:700;cursor:pointer;
                font-family:inherit;transition:all 0.15s ease;
              ">
                <span>💬</span>
                <span>${displayShareWhatsApp}</span>
              </button>
              ${(r.deviceId === myId || isAdmin) ? `
                <button onclick="window.lrDeleteReport('${r.id}')" style="
                  display:inline-flex;align-items:center;justify-content:center;
                  width:24px;height:24px;border-radius:50%;
                  border:1px solid rgba(244,63,94,0.3);
                  background:rgba(244,63,94,0.08);
                  color:var(--clr-red);
                  font-size:0.75rem;cursor:pointer;
                  font-family:inherit;transition:all 0.15s ease;
                " title="${lang === "en" ? "Delete Report" : "حذف البلاغ"}">
                  <span>🗑️</span>
                </button>
              ` : ""}
            </div>
          </div>
          ${r.photo ? `<img src="${r.photo}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-top:12px;display:block;">` : ""}
        </div>
      `;

      L.marker([r.lat, r.lng], { icon })
        .bindPopup(popup, {
          maxWidth: 280,
          closeButton: false,
          className: "lr-popup",
        })
        .addTo(markersRef.current);
    });
  }, [reports, lang, isAdmin]);

  // ── Render watch circles ───────────────────────────────────
  useEffect(() => {
    if (!watchRef.current) return;
    watchRef.current.clearLayers();
    watchAreas.forEach((w) => {
      L.circle([w.lat, w.lng], {
        radius: w.radius,
        className: "leaflet-watch-circle",
        interactive: false,
      }).addTo(watchRef.current);
    });
  }, [watchAreas]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* ── Map Style Switcher ── */}
      <div style={{
        position: "absolute", top: "80px", right: "16px", zIndex: 400,
        background: "rgba(7,11,20,0.85)", backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "9999px", padding: "4px", display: "flex", gap: "2px",
      }}>
        {[
          { key: "voyager",   label_en: "Clean",     label_ar: "مبسط" },
          { key: "detailed",  label_en: "Detailed",  label_ar: "تفصيلي"  },
          { key: "satellite", label_en: "Satellite", label_ar: "فضائي"  },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStyle(s.key)}
            style={{
              padding: "5px 12px", borderRadius: "9999px", border: "none",
              background: style === s.key ? "var(--gold-400)" : "transparent",
              color: style === s.key ? "#1a0900" : "var(--tx-3)",
              fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
              fontFamily: "var(--font)", transition: "all 0.18s ease",
              whiteSpace: "nowrap",
            }}
          >
            {lang === "en" ? s.label_en : s.label_ar}
          </button>
        ))}
      </div>

      {/* ── Locate Me Button (Professional Glassmorphic Style) ── */}
      <button
        onClick={handleLocateUser}
        disabled={isLocating}
        title={lang === "en" ? "Locate Me" : "تحديد موقعي"}
        style={{
          position: "absolute",
          top: "132px",
          right: "16px",
          zIndex: 400,
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(7, 11, 20, 0.75)",
          backdropFilter: "blur(16px)",
          color: "var(--gold-400)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isLocating ? "default" : "pointer",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          padding: 0,
          boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
          outline: "none",
        }}
        onMouseEnter={(e) => {
          if (!isLocating) {
            e.currentTarget.style.border = "1px solid var(--gold-400)";
            e.currentTarget.style.boxShadow = "var(--shadow-gold)";
            e.currentTarget.style.transform = "scale(1.05)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.border = "1px solid rgba(255, 255, 255, 0.08)";
          e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.45)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {isLocating ? (
          <div className="spinner" style={{ borderTopColor: "var(--gold-400)" }} />
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="1" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="23" />
            <line x1="1" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="23" y2="12" />
          </svg>
        )}
      </button>
    </div>
  );
}
