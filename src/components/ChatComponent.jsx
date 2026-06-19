import React, { useState, useEffect, useRef } from "react";
import { strings } from "../locales/strings";
import { showToast } from "./NotificationToast";
import { dbService } from "../services/db";
import { registerPlugin } from "@capacitor/core";

// Register Capacitor Native Plugin safely
let OfflineChat = null;
try {
  OfflineChat = registerPlugin("OfflineChat");
} catch (e) {
  console.log("OfflineChat native plugin not loaded (running on Web)");
}

// SVGs for Chat Icon, Location, Send, and User Info
const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 48, height: 48, color: "var(--clr-amber)", marginBottom: 12 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

export default function ChatComponent({ lang, userCoords, requestUserLocation }) {
  const t = strings[lang];
  const isRTL = t.direction === "rtl";
  const [activeRoom, setActiveRoom] = useState("general"); // "general" | "local" | "mesh"
  
  // States
  const [messages, setMessages] = useState([]);
  const [meshMessages, setMeshMessages] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const messagesEndRef = useRef(null);

  // Mesh Native States
  const [meshActive, setMeshActive] = useState(false);
  const [meshConnectionState, setMeshConnectionState] = useState("Idle");
  const [discoveredNodes, setDiscoveredNodes] = useState("");

  // 1. Subscribe to online real-time chat messages via dbService
  useEffect(() => {
    if (!dbService.isConfigured()) {
      const stored = localStorage.getItem("libya_report_chat_messages");
      if (!stored) {
        const initial = [
          {
            id: "m1",
            room: "general",
            sender: lang === "en" ? "Yousef K." : "يوسف ك.",
            text: lang === "en" ? "Welcome to Libya Reports community chat! Let's cooperate to keep our cities clean and safe." : "مرحباً بكم في دردشة مجتمع بلاغات ليبيا! دعونا نتعاون للحفاظ على نظافة وأمان مدننا.",
            timestamp: Date.now() - 3600000 * 3,
            role: "civicLeader",
            lat: 32.8872,
            lng: 13.1913
          },
          {
            id: "m2",
            room: "general",
            sender: lang === "en" ? "Fatima Al-Warfali" : "فاطمة الورفلي",
            text: lang === "en" ? "Thank you! The municipal team is responsive, they resolved a street light report in our district yesterday." : "شكراً لكم! فريق البلدية متجاوب، لقد حلوا بلاغ إنارة الشوارع في حيّنا بالأمس.",
            timestamp: Date.now() - 3600000 * 2,
            role: "activeCitizen",
            lat: 32.8950,
            lng: 13.1800
          },
          {
            id: "m3",
            room: "local",
            sender: lang === "en" ? "Ali Mansour" : "علي منصور",
            text: lang === "en" ? "Heads up: Street flooding near Gargaresh. Drive carefully!" : "انتبهوا: تجمع مياه أمطار في منطقة قرقارش. القيادة بحذر!",
            timestamp: Date.now() - 1800000,
            role: "communityHero",
            lat: 32.8820,
            lng: 13.1420
          },
          {
            id: "m4",
            room: "local",
            sender: lang === "en" ? "Salah B." : "صلاح ب.",
            text: lang === "en" ? "Is the power outage still ongoing in Abu Salim?" : "هل لا يزال انقطاع الكهرباء مستمراً في أبو سليم؟",
            timestamp: Date.now() - 900000,
            role: "anonymousUser",
            lat: 32.8450,
            lng: 13.1720
          }
        ];
        localStorage.setItem("libya_report_chat_messages", JSON.stringify(initial));
      }
    }

    const unsubscribe = dbService.subscribeChatMessages((data) => {
      setMessages(data);
    });

    return () => unsubscribe();
  }, [lang]);

  const handleIncomingMeshPacket = (msg) => {
    const content = msg.content || msg.text || "";
    if (content.startsWith("__REPORT__:")) {
      try {
        const report = JSON.parse(content.substring(11));
        dbService.addPeerReport(report).then(added => {
          if (added) {
            showToast(lang === "en" ? "Synced 1 report from neighbor via mesh!" : "تمت مزامنة بلاغ واحد من جار عبر الشبكة المباشرة!", "info");
          }
        });
      } catch (e) {
        console.error("Failed parsing peer report", e);
      }
      return true;
    }
    if (content.startsWith("__CHAT_MSG__:")) {
      try {
        const peerMsg = JSON.parse(content.substring(13));
        dbService.addPeerChatMessage(peerMsg).then(added => {
          if (added) {
            showToast(lang === "en" ? `Synced chat message from ${peerMsg.sender}!` : `تمت مزامنة رسالة دردشة من ${peerMsg.sender}!`, "info");
          }
        });
      } catch (e) {
        console.error("Failed parsing peer chat message", e);
      }
      return true;
    }
    return false;
  };

  // 2. Wire Mesh Native Listeners if loaded on Android
  useEffect(() => {
    let messageListener = null;
    let stateListener = null;
    let nodeListener = null;

    const setupMesh = async () => {
      if (OfflineChat) {
        try {
          // Sync cached mesh messages
          const res = await OfflineChat.getMessages();
          if (res && res.messages) {
            const filtered = res.messages.filter(msg => {
              const content = msg.content || msg.text || "";
              if (content.startsWith("__REPORT__:") || content.startsWith("__CHAT_MSG__:")) {
                handleIncomingMeshPacket(msg);
                return false;
              }
              return true;
            });
            setMeshMessages(filtered);
          }

          // Register event handlers
          messageListener = await OfflineChat.addListener("onMessageReceived", (msg) => {
            const content = msg.content || msg.text || "";
            if (content.startsWith("__REPORT__:") || content.startsWith("__CHAT_MSG__:")) {
              handleIncomingMeshPacket(msg);
              return;
            }
            setMeshMessages((prev) => {
              const duplicate = prev.some && prev.some(m => m.sender === msg.sender && (m.content || m.text) === content && Math.abs(m.timestamp - msg.timestamp) < 3000);
              if (duplicate) return prev;
              const next = [...prev, msg].sort((a,b) => a.timestamp - b.timestamp);
              return next;
            });
          });

          stateListener = await OfflineChat.addListener("onConnectionStateChanged", (data) => {
            setMeshConnectionState(data.state || "Idle");
          });

          nodeListener = await OfflineChat.addListener("onDiscoveredNodesChanged", (data) => {
            setDiscoveredNodes(data.nodes || "");
          });
        } catch (err) {
          console.error("Failed setting up native mesh listeners", err);
        }
      }
    };
    setupMesh();

    return () => {
      if (messageListener) messageListener.remove();
      if (stateListener) stateListener.remove();
      if (nodeListener) nodeListener.remove();
    };
  }, [lang]);

  // 3. Web simulation loop for local testing in the browser
  useEffect(() => {
    let simulationTimer = null;
    if (activeRoom === "mesh" && meshActive && !OfflineChat) {
      // Periodic mock neighbor discoveries on Web
      const mockNeighborsAr = [
        "سالم أ.",
        "خالد محمود",
        "نسرين الطرابلسي"
      ];
      const mockNeighborsEn = [
        "Salem A.",
        "Khaled Mahmoud",
        "Nesrine T."
      ];
      const mockMeshTextsAr = [
        "الإنترنت مقطوع بالكامل لدينا في بن عاشور. هل تسمعونني؟",
        "نعم، الإرسال ضعيف جداً. نحن نتواصل عبر راديو الهاتف.",
        "الرجاء إبلاغ المارة بأن طريق المطار مغلق حالياً."
      ];
      const mockMeshTextsEn = [
        "Internet is fully down here in Ben Ashour. Can anyone hear me?",
        "Yes, cell signal is dead. We are using local mesh chat.",
        "Please warn drivers that Airport Road is blocked."
      ];

      simulationTimer = setInterval(() => {
        const isControlPacket = Math.random() < 0.4;
        const name = lang === "en" ? mockNeighborsEn[Math.floor(Math.random() * mockNeighborsEn.length)] : mockNeighborsAr[Math.floor(Math.random() * mockNeighborsAr.length)];
        
        if (isControlPacket) {
          const syncReport = Math.random() < 0.5;
          if (syncReport) {
            const mockCategories = ["electricity", "flooding", "waterLeak", "streetlight"];
            const cat = mockCategories[Math.floor(Math.random() * mockCategories.length)];
            const mockReport = {
              id: "rep_peer_" + Math.random().toString(36).substr(2, 9),
              ticketCode: Math.floor(100000 + Math.random() * 900000).toString(),
              deviceId: "dev_peer_" + name.replace(/\s+/g, ''),
              hardwareId: "WEB_MOCK_PEER",
              category: cat,
              description: lang === "en" ? `Problem with ${cat} reported by neighbor.` : `مشكلة في ${cat} تم رصدها بواسطة الجار.`,
              lat: userCoords ? userCoords.lat + (Math.random() - 0.5) * 0.02 : 32.8872,
              lng: userCoords ? userCoords.lng + (Math.random() - 0.5) * 0.02 : 13.1913,
              status: "Reported",
              timestamp: Date.now(),
              upvotes: 0,
              upvotedDevices: []
            };
            const mockPacket = {
              sender: name,
              content: "__REPORT__:" + JSON.stringify(mockReport),
              timestamp: Date.now()
            };
            handleIncomingMeshPacket(mockPacket);
          } else {
            const mockPeerMsg = {
              id: "msg_peer_" + Math.random().toString(36).substr(2, 9),
              room: "general",
              sender: name,
              text: lang === "en" ? "Greetings! Communicating through delay-tolerant networking sync." : "تحياتي! نتواصل عبر مزامنة الشبكة المباشرة المقاومة للانقطاع.",
              role: "activeCitizen",
              timestamp: Date.now(),
              lat: userCoords ? userCoords.lat : 32.8872,
              lng: userCoords ? userCoords.lng : 13.1913
            };
            const mockPacket = {
              sender: name,
              content: "__CHAT_MSG__:" + JSON.stringify(mockPeerMsg),
              timestamp: Date.now()
            };
            handleIncomingMeshPacket(mockPacket);
          }
        } else {
          const index = Math.floor(Math.random() * mockMeshTextsAr.length);
          const text = lang === "en" ? mockMeshTextsEn[index] : mockMeshTextsAr[index];

          const mockMsg = {
            sender: name,
            content: text,
            timestamp: Date.now(),
            isSystem: false,
            lat: userCoords ? userCoords.lat + (Math.random() - 0.5) * 0.04 : 32.8872,
            lng: userCoords ? userCoords.lng + (Math.random() - 0.5) * 0.04 : 13.1913
          };

          setMeshMessages((prev) => [...prev, mockMsg].sort((a,b) => a.timestamp - b.timestamp));
        }
        
        setDiscoveredNodes((prev) => prev ? `${prev}, UDP:${name}` : `UDP:${name}`);
        showToast(lang === "en" ? `Connected to mesh node: ${name}` : `تم الاتصال بعقدة الشبكة: ${name}`, "info");
      }, 9000);
    }

    return () => clearInterval(simulationTimer);
  }, [activeRoom, meshActive, lang, userCoords]);

  // Scroll to bottom on room switch or new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, meshMessages, activeRoom]);

  // Haversine distance formula to calculate distance in km
  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 99999;
    const R = 6371; // Radius of earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Toggle Mesh Engine Native / Simulation
  const toggleMeshEngine = async () => {
    const nextState = !meshActive;
    setMeshActive(nextState);

    if (OfflineChat) {
      try {
        if (nextState) {
          await OfflineChat.startMeshEngine();
          setMeshConnectionState("Broadcasting & Scanning");
          showToast(lang === "en" ? "Offline Mesh Engine Activated!" : "تم تشغيل المحرك الشبكي المحلي!", "success");
        } else {
          await OfflineChat.stopMeshEngine();
          setMeshConnectionState("Idle");
          setDiscoveredNodes("");
          showToast(lang === "en" ? "Mesh Engine Stopped" : "تم إيقاف المحرك الشبكي", "warning");
        }
      } catch (err) {
        showToast("Mesh error: " + err.message, "error");
      }
    } else {
      // Web simulation feedback
      setMeshConnectionState(nextState ? "Broadcasting & Scanning (Web Mock)" : "Idle");
      if (!nextState) setDiscoveredNodes("");
      showToast(
        nextState 
          ? (lang === "en" ? "Web Simulation Mesh Started!" : "بدأ محاكي الشبكة المحلية!")
          : (lang === "en" ? "Mesh Stopped" : "تم إيقاف المحاكي"),
        nextState ? "success" : "warning"
      );
    }
  };

  // Filter messages for current room
  const filteredMessages = messages.filter((msg) => {
    if (msg.room === "general") {
      return activeRoom === "general";
    }
    if (msg.room === "local") {
      if (activeRoom !== "local") return false;
      // If no userCoords, don't show local messages
      if (!userCoords) return false;
      // Proximity limit: check if message was sent within 10km radius of the current user
      if (!msg.lat || !msg.lng) return false;
      const d = getDistance(userCoords.lat, userCoords.lng, msg.lat, msg.lng);
      return d <= 10;
    }
    return false;
  });

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const myName = localStorage.getItem("libya_report_name") || t.anonymousUser;
    const myRole = localStorage.getItem("libya_report_role") || "anonymousUser";

    if (activeRoom === "mesh") {
      // ── MESH ROOM SENDING ──
      const latVal = userCoords ? userCoords.lat : null;
      const lngVal = userCoords ? userCoords.lng : null;

      if (OfflineChat) {
        try {
          await OfflineChat.sendMeshMessage({
            text: inputVal,
            sender: myName,
            lat: latVal,
            lng: lngVal
          });
          // Optimistically append local message
          setMeshMessages((prev) => [
            ...prev,
            { sender: myName, content: inputVal, timestamp: Date.now(), isSystem: false, lat: latVal, lng: lngVal }
          ]);
          setInputVal("");
        } catch (err) {
          showToast("Failed to broadcast mesh message", "error");
        }
      } else {
        // Web mesh send simulation
        const mockMsg = {
          sender: myName,
          content: inputVal,
          timestamp: Date.now(),
          isSystem: false,
          lat: latVal,
          lng: lngVal
        };
        setMeshMessages((prev) => [...prev, mockMsg]);
        setInputVal("");
      }
      return;
    }

    // ── GENERAL & LOCAL ROOM SENDING ──
    if (activeRoom === "local" && !userCoords) {
      showToast(t.locationRequiredChat, "error");
      return;
    }

    const msgPayload = {
      room: activeRoom,
      sender: myName,
      text: inputVal,
      role: myRole,
      lat: userCoords ? userCoords.lat : null,
      lng: userCoords ? userCoords.lng : null
    };

    try {
      const msg = await dbService.sendChatMessage(msgPayload);
      setInputVal("");

      if (!navigator.onLine) {
        const payloadStr = "__CHAT_MSG__:" + JSON.stringify(msg);
        if (OfflineChat) {
          try {
            await OfflineChat.sendMeshMessage({
              text: payloadStr,
              sender: myName,
              lat: userCoords ? userCoords.lat : null,
              lng: userCoords ? userCoords.lng : null
            });
          } catch (e) {
            console.log("Failed to broadcast chat over native mesh:", e);
          }
        } else {
          showToast(lang === "en" ? "Queued and broadcasted chat message via simulated mesh!" : "تم حفظ الرسالة وبثها عبر محاكي الشبكة!", "info");
        }
      }

      // Simulate local community response only in offline mode for demo purposes
      if (!dbService.isConfigured()) {
        setTimeout(() => {
          simulateReply(activeRoom);
        }, 2000);
      }
    } catch (err) {
      showToast("Failed to send message", "error");
    }
  };

  const simulateReply = (room) => {
    const namesAr = ["محمد", "مريم", "أحمد", "منى", "عبدالرحمن"];
    const namesEn = ["Mohamed", "Mariam", "Ahmed", "Mona", "Abdulrahman"];
    const textArGeneral = [
      "شكراً على التحديث! سنتابع الموضوع مع البلدية.",
      "تطبيق ممتاز يساعدنا في تنظيم البلاغات.",
      "رائع جداً! العمل المجتمعي هو الحل.",
      "هل هناك تفاصيل إضافية بخصوص هذا الموضوع؟"
    ];
    const textEnGeneral = [
      "Thanks for the update! We will follow up.",
      "Great app, helps organize civic reports.",
      "Indeed! Community work is key.",
      "Are there more details on this issue?"
    ];
    const textArLocal = [
      "أنا بالقرب من المنطقة والوضع مستقر الآن.",
      "شكراً للتنبيه، سأتجنب هذا الطريق.",
      "الكهرباء انقطعت لدينا أيضاً منذ ساعة.",
      "أرجو من الجميع توخي الحذر الشديد."
    ];
    const textEnLocal = [
      "I'm nearby, and the situation is stable now.",
      "Thanks for the alert, I'll avoid that route.",
      "Power is also out here for an hour now.",
      "Please stay safe everyone."
    ];

    const isEng = lang === "en";
    const sender = isEng ? namesEn[Math.floor(Math.random() * namesEn.length)] : namesAr[Math.floor(Math.random() * namesAr.length)];
    const text = room === "general" 
      ? (isEng ? textEnGeneral[Math.floor(Math.random() * textEnGeneral.length)] : textArGeneral[Math.floor(Math.random() * textArGeneral.length)])
      : (isEng ? textEnLocal[Math.floor(Math.random() * textEnLocal.length)] : textArLocal[Math.floor(Math.random() * textArLocal.length)]);

    // Generate close coordinates if it's local
    const baseLat = userCoords ? userCoords.lat : 32.8872;
    const baseLng = userCoords ? userCoords.lng : 13.1913;
    const offsetLat = (Math.random() - 0.5) * 0.05; // ~5km range
    const offsetLng = (Math.random() - 0.5) * 0.05;

    const botMsg = {
      room: room,
      sender: sender,
      text: text,
      role: ["activeCitizen", "communityHero", "anonymousUser"][Math.floor(Math.random() * 3)],
      lat: baseLat + offsetLat,
      lng: baseLng + offsetLng
    };

    dbService.sendChatMessage(botMsg);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "civicLeader":
        return { emoji: "👑", text: t.civicLeader, class: "badge-leader" };
      case "communityHero":
        return { emoji: "🛡️", text: t.communityHero, class: "badge-hero" };
      case "activeCitizen":
        return { emoji: "⭐", text: t.activeCitizen, class: "badge-citizen" };
      default:
        return null;
    }
  };

  return (
    <div className="chat-container" style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-900)" }}>
      {/* Rooms tab selection header */}
      <div style={{
        display: "flex",
        background: "rgba(255, 255, 255, 0.03)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "6px"
      }}>
        <button
          type="button"
          onClick={() => setActiveRoom("general")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            borderRadius: "var(--r-md)",
            background: activeRoom === "general" ? "rgba(255, 255, 255, 0.06)" : "transparent",
            color: activeRoom === "general" ? "var(--tx-1)" : "var(--tx-3)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.8rem",
            transition: "all 0.2s"
          }}
        >
          🌐 {t.generalChat}
        </button>
        <button
          type="button"
          onClick={() => setActiveRoom("local")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            borderRadius: "var(--r-md)",
            background: activeRoom === "local" ? "rgba(255, 255, 255, 0.06)" : "transparent",
            color: activeRoom === "local" ? "var(--tx-1)" : "var(--tx-3)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.8rem",
            transition: "all 0.2s"
          }}
        >
          📍 {t.localChat}
        </button>
        <button
          type="button"
          onClick={() => setActiveRoom("mesh")}
          style={{
            flex: 1.2,
            padding: "10px",
            border: "none",
            borderRadius: "var(--r-md)",
            background: activeRoom === "mesh" ? "rgba(255, 255, 255, 0.06)" : "transparent",
            color: activeRoom === "mesh" ? "var(--tx-1)" : "var(--tx-3)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.8rem",
            transition: "all 0.2s"
          }}
        >
          📶 {t.offlineMesh}
        </button>
      </div>

      {/* Mesh Control Header */}
      {activeRoom === "mesh" && (
        <div style={{
          background: "rgba(0,0,0,0.2)",
          padding: "12px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div className={`online-dot ${meshActive ? "" : "offline-dot"}`} style={{
                background: meshActive ? "var(--clr-cyan)" : "var(--clr-red)",
                boxShadow: meshActive ? "0 0 6px var(--clr-cyan)" : "0 0 6px var(--clr-red)"
              }} />
              <span style={{ color: "var(--tx-2)", fontWeight: 600 }}>
                {meshConnectionState}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleMeshEngine}
              style={{
                background: meshActive ? "rgba(244,63,94,0.12)" : "rgba(6,182,212,0.12)",
                border: meshActive ? "1px solid rgba(244,63,94,0.3)" : "1px solid rgba(6,182,212,0.3)",
                color: meshActive ? "var(--clr-red)" : "var(--clr-cyan)",
                borderRadius: "var(--r-sm)",
                padding: "4px 8px",
                fontSize: "0.72rem",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              {meshActive ? t.deactivateMesh : t.activateMesh}
            </button>
          </div>
          {discoveredNodes && (
            <div style={{ color: "var(--tx-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <strong>{t.discoveredNodesLabel}</strong> {discoveredNodes}
            </div>
          )}
        </div>
      )}

      {/* Message Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {activeRoom === "local" && !userCoords ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            textAlign: "center",
            padding: "0 20px"
          }}>
            <IconAlert />
            <h4 style={{ color: "var(--tx-1)", marginBottom: "8px", fontWeight: 600 }}>{lang === "en" ? "Location Required" : "مطلوب تحديد الموقع"}</h4>
            <p style={{ color: "var(--tx-3)", fontSize: "0.8rem", lineHeight: 1.5, marginBottom: "20px" }}>
              {t.locationRequiredChat}
            </p>
            <button
              type="button"
              onClick={requestUserLocation}
              className="btn-submit"
              style={{ padding: "10px 20px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              📍 {t.enableLocation}
            </button>
          </div>
        ) : activeRoom === "mesh" && !meshActive ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--tx-3)",
            textAlign: "center",
            padding: "0 20px"
          }}>
            <span style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📶</span>
            <h4 style={{ color: "var(--tx-1)", marginBottom: "8px", fontWeight: 600 }}>
              {lang === "en" ? "Offline Mesh Chat" : "الدردشة الشبكية دون اتصال"}
            </h4>
            <p style={{ fontSize: "0.8rem", lineHeight: 1.5, marginBottom: "20px" }}>
              {lang === "en" 
                ? "Connect directly with nearby neighbors using Wi-Fi Direct mesh without cellular data or internet connection." 
                : "تواصل مباشرة مع جيرانك المحيطين بك باستخدام شبكة الواي فاي المباشرة دون الحاجة لبيانات الهاتف أو اتصال بالإنترنت."}
            </p>
            <button
              type="button"
              onClick={toggleMeshEngine}
              className="btn-submit"
              style={{ padding: "10px 20px" }}
            >
              ⚡ {t.activateMesh}
            </button>
          </div>
        ) : (activeRoom === "mesh" ? meshMessages : filteredMessages).length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--tx-3)"
          }}>
            <span style={{ fontSize: "2rem", marginBottom: "8px" }}>💬</span>
            <span style={{ fontSize: "0.85rem" }}>{t.noMessages}</span>
          </div>
        ) : (
          (activeRoom === "mesh" ? meshMessages : filteredMessages).map((msg, index) => {
            const badge = getRoleBadge(msg.role);
            return (
              <div
                key={msg.id || index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignSelf: "flex-start",
                  width: "100%",
                  direction: isRTL ? "rtl" : "ltr"
                }}
              >
                {/* Message Header (Sender name + Badge) */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "4px",
                  fontSize: "0.75rem",
                  color: "var(--tx-3)"
                }}>
                  <span style={{ fontWeight: 600, color: "var(--tx-2)" }}>{msg.sender}</span>
                  {badge && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "2px 6px",
                        borderRadius: "var(--r-pill)",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "2px"
                      }}
                      title={badge.text}
                    >
                      {badge.emoji} {badge.text}
                    </span>
                  )}
                  <span style={{ fontSize: "0.65rem", opacity: 0.6 }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message text bubble */}
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-subtle)",
                  padding: "10px 14px",
                  borderRadius: isRTL 
                    ? "0 var(--r-md) var(--r-md) var(--r-md)" 
                    : "var(--r-md) 0 var(--r-md) var(--r-md)",
                  maxWidth: "85%",
                  width: "fit-content",
                  fontSize: "0.85rem",
                  lineHeight: 1.4,
                  color: "var(--tx-1)",
                  wordBreak: "break-word"
                }}>
                  {msg.text || msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      {(activeRoom === "general" || (activeRoom === "local" && userCoords) || (activeRoom === "mesh" && meshActive)) && (
        <form
          onSubmit={handleSend}
          style={{
            display: "flex",
            gap: "8px",
            padding: "12px 18px 24px",
            borderTop: "1px solid var(--border-subtle)",
            background: "rgba(0,0,0,0.15)",
            direction: isRTL ? "rtl" : "ltr"
          }}
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={t.typeMessage}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-pill)",
              padding: "12px 18px",
              fontSize: "0.85rem",
              color: "var(--tx-1)",
              outline: "none",
              direction: isRTL ? "rtl" : "ltr"
            }}
          />
          <button
            type="submit"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "var(--clr-gold)",
              border: "none",
              color: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transform: isRTL ? "scaleX(-1)" : "none"
            }}
          >
            <IconSend />
          </button>
        </form>
      )}
    </div>
  );
}
