import { getDeviceFingerprint } from "./fingerprint";
import { firestore, isConfigured } from "./firebase";
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy, onSnapshot,
  arrayUnion, arrayRemove, increment, limit
} from "firebase/firestore";

// Seed data with realistic Libyan city coordinates (Tripoli, Benghazi, Misrata, Sebha, Khoms)
const SEED_REPORTS = [
  {
    id: "rep_seed_1",
    ticketCode: "100001",
    category: "electricity",
    description: "Power grid failure in Tripoli, Al-Dahra district. Outage lasting 4+ hours.",
    lat: 32.8752,
    lng: 13.1874,
    status: "Reported",
    timestamp: Date.now() - 3600000 * 24 * 2, // 2 days ago
    deviceId: "dev_mock_1",
    photo: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=600&q=80",
    upvotes: 2,
    upvotedDevices: ["dev_user_1", "dev_user_2"]
  },
  {
    id: "rep_seed_2",
    ticketCode: "100002",
    category: "flooding",
    description: "Flooding on Ring Road 2 in Tripoli due to heavy rain. Drainage completely blocked.",
    lat: 32.8450,
    lng: 13.2200,
    status: "In Progress",
    timestamp: Date.now() - 3600000 * 8, // 8 hours ago
    deviceId: "dev_mock_2",
    photo: "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80",
    upvotes: 6,
    upvotedDevices: ["dev_user_1", "dev_user_2", "dev_user_3", "dev_user_4", "dev_user_5", "dev_user_6"] // Severe spot (>5 upvotes) to test glow effect
  },
  {
    id: "rep_seed_3",
    ticketCode: "100003",
    category: "waterLeak",
    description: "Major water pipe leak in Benghazi, Al-Hadaeq district. Water flooding the street.",
    lat: 32.0988,
    lng: 20.1612,
    status: "Reported",
    timestamp: Date.now() - 3600000 * 18,
    deviceId: "dev_mock_3",
    photo: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
    upvotes: 0,
    upvotedDevices: []
  },
  {
    id: "rep_seed_4",
    ticketCode: "100004",
    category: "streetlight",
    description: "Broken streetlights along Misrata central avenue. Zero visibility at night.",
    lat: 32.3620,
    lng: 15.0921,
    status: "Resolved",
    timestamp: Date.now() - 3600000 * 36, // 36 hours ago
    deviceId: "dev_mock_4",
    photo: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80",
    upvotes: 1,
    upvotedDevices: ["dev_user_1"],
    resolvedAt: Date.now() - 3600000 * 12 // 12 hours ago
  },
  {
    id: "rep_seed_5",
    ticketCode: "100005",
    category: "electricity",
    description: "Transformer explosion in Sebha, Al-Manshiya district. Sparks and fire reported.",
    lat: 27.0194,
    lng: 14.4340,
    status: "Reported",
    timestamp: Date.now() - 3600000 * 12,
    deviceId: "dev_mock_5",
    photo: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
    upvotes: 4,
    upvotedDevices: ["dev_user_1", "dev_user_2", "dev_user_3", "dev_user_4"]
  },
  {
    id: "rep_seed_6",
    ticketCode: "100006",
    category: "other",
    description: "Garbage blocking footpaths in Khoms near historical ruins. Public hazard.",
    lat: 32.6330,
    lng: 14.2650,
    status: "Reported",
    timestamp: Date.now() - 3600000 * 4,
    deviceId: "dev_mock_6",
    photo: null,
    upvotes: 0,
    upvotedDevices: []
  }
];

// Memory caches loaded from IndexedDB and synced via onSnapshot listeners
let reportsCache = [...SEED_REPORTS];
let blacklistCache = [];
let queueCache = [];
let cooldownsCache = {};

// IndexedDB implementation
const IDB_NAME = "libya_report_idb";
const IDB_VERSION = 1;

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("store")) {
        db.createObjectStore("store");
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("store", "readonly");
      const req = tx.objectStore("store").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("IndexedDB get error:", e);
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("store", "readwrite");
      const req = tx.objectStore("store").put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("IndexedDB set error:", e);
  }
}

// Load data asynchronously on app initialization
async function initIDB() {
  const localReports = await idbGet("reports");
  if (localReports) {
    reportsCache = localReports;
  } else {
    reportsCache = [...SEED_REPORTS];
    await idbSet("reports", SEED_REPORTS);
  }

  const localBlacklist = await idbGet("blacklist");
  if (localBlacklist) {
    blacklistCache = localBlacklist;
  } else {
    await idbSet("blacklist", []);
  }

  const localQueue = await idbGet("queue");
  if (localQueue) {
    queueCache = localQueue;
  } else {
    await idbSet("queue", []);
  }

  const localCooldowns = await idbGet("cooldowns");
  if (localCooldowns) {
    cooldownsCache = localCooldowns;
  } else {
    await idbSet("cooldowns", {});
  }

  window.dispatchEvent(new CustomEvent("libya_report_new", { detail: reportsCache }));
}
initIDB();

// Set up real-time Firebase listeners if configured
if (isConfigured) {
  // 1. Sync reports
  const qReports = query(collection(firestore, "reports"), orderBy("timestamp", "desc"));
  onSnapshot(qReports, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    reportsCache = list;
    idbSet("reports", list);
    window.dispatchEvent(new CustomEvent("libya_report_new", { detail: list }));
  }, (err) => {
    console.error("Firestore reports listener error:", err);
  });

  // 2. Sync blacklist
  onSnapshot(collection(firestore, "blacklist"), (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push(doc.id);
    });
    blacklistCache = list;
    idbSet("blacklist", list);
  }, (err) => {
    console.error("Firestore blacklist listener error:", err);
  });
}

export const dbService = {
  isConfigured: () => isConfigured,

  subscribeReports: (callback) => {
    if (!isConfigured) return () => {};
    const q = query(collection(firestore, "reports"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      callback(list);
    }, (err) => {
      console.error("subscribeReports Firestore error:", err);
    });
  },

  getReports: () => {
    return reportsCache;
  },

  isDeviceBanned: (deviceId) => {
    return blacklistCache.includes(deviceId);
  },

  setDeviceBanned: async (deviceId, isBanned) => {
    if (isBanned) {
      if (!blacklistCache.includes(deviceId)) blacklistCache.push(deviceId);
    } else {
      blacklistCache = blacklistCache.filter(id => id !== deviceId);
    }
    await idbSet("blacklist", blacklistCache);

    if (isConfigured) {
      try {
        const docRef = doc(firestore, "blacklist", deviceId);
        if (isBanned) {
          await setDoc(docRef, { bannedAt: Date.now() });
        } else {
          await deleteDoc(docRef);
        }
      } catch (err) {
        console.error("Failed to update blacklist in Firestore:", err);
      }
    }
  },

  getBannedDevices: () => {
    return blacklistCache;
  },

  checkRateLimit: (deviceId) => {
    const lastSubmission = cooldownsCache[deviceId];
    if (lastSubmission) {
      const remaining = 60000 - (Date.now() - lastSubmission);
      if (remaining > 0) {
        return Math.ceil(remaining / 1000);
      }
    }
    return 0;
  },

  updateRateLimit: async (deviceId) => {
    cooldownsCache[deviceId] = Date.now();
    await idbSet("cooldowns", cooldownsCache);
  },

  submitReport: async (reportData) => {
    const deviceId = getDeviceFingerprint();

    if (dbService.isDeviceBanned(deviceId)) {
      throw new Error("BLACKLISTED");
    }

    const cooldownLeft = dbService.checkRateLimit(deviceId);
    if (cooldownLeft > 0) {
      throw new Error(`COOLDOWN:${cooldownLeft}`);
    }

    const tempId = "rep_" + Math.random().toString(36).substr(2, 9);
    const newReport = {
      deviceId: deviceId,
      ticketCode: Math.floor(100000 + Math.random() * 900000).toString(),
      hardwareId: reportData.hardwareId || "WEB_FALLBACK",
      ipAddress: reportData.ipAddress || "Unknown IP",
      ispProvider: reportData.ispProvider || "Unknown ISP",
      status: "Reported",
      timestamp: Date.now(),
      upvotes: 0,
      upvotedDevices: [],
      ...reportData
    };

    if (!navigator.onLine) {
      queueCache.push({ id: tempId, ...newReport });
      await idbSet("queue", queueCache);
      reportsCache.unshift({ id: tempId, ...newReport });
      await idbSet("reports", reportsCache);
      return { status: "queued", report: { id: tempId, ...newReport } };
    }

    if (isConfigured) {
      try {
        const docRef = await addDoc(collection(firestore, "reports"), newReport);
        dbService.updateRateLimit(deviceId);
        return { status: "success", report: { id: docRef.id, ...newReport } };
      } catch (err) {
        console.error("Firestore submission failed, fallback to offline queue", err);
        queueCache.push({ id: tempId, ...newReport });
        await idbSet("queue", queueCache);
        reportsCache.unshift({ id: tempId, ...newReport });
        await idbSet("reports", reportsCache);
        return { status: "queued", report: { id: tempId, ...newReport } };
      }
    }

    reportsCache.unshift({ id: tempId, ...newReport });
    await idbSet("reports", reportsCache);
    dbService.updateRateLimit(deviceId);

    window.dispatchEvent(new CustomEvent("libya_report_new", { detail: reportsCache }));
    return { status: "success", report: { id: tempId, ...newReport } };
  },

  updateReportStatus: async (reportId, newStatus) => {
    const isResolved = newStatus === "Resolved";
    const updateFields = { 
      status: newStatus,
      resolvedAt: isResolved ? Date.now() : null
    };

    const index = reportsCache.findIndex(r => r.id === reportId);
    if (index !== -1) {
      reportsCache[index] = { ...reportsCache[index], ...updateFields };
      await idbSet("reports", reportsCache);
    }

    if (isConfigured) {
      try {
        const docRef = doc(firestore, "reports", reportId);
        await updateDoc(docRef, updateFields);
        return true;
      } catch (err) {
        console.error("Firestore status update failed:", err);
        return false;
      }
    }
    return index !== -1;
  },

  deleteReport: async (reportId) => {
    reportsCache = reportsCache.filter(r => r.id !== reportId);
    await idbSet("reports", reportsCache);
    window.dispatchEvent(new CustomEvent("libya_report_new"));

    if (isConfigured) {
      try {
        await deleteDoc(doc(firestore, "reports", reportId));
        return true;
      } catch (err) {
        console.error("Firestore delete failed:", err);
        return false;
      }
    }
    return true;
  },

  syncQueue: async () => {
    const myId = getDeviceFingerprint();
    let syncCount = 0;

    // 1. Sync reports
    if (queueCache.length > 0) {
      const toSync = [...queueCache];
      queueCache = [];
      await idbSet("queue", []);
      
      if (isConfigured) {
        for (const report of toSync) {
          if (!dbService.isDeviceBanned(report.deviceId)) {
            try {
              const { id, ...cleanReport } = report;
              await addDoc(collection(firestore, "reports"), cleanReport);
              syncCount++;
            } catch (err) {
              console.error("Failed syncing queued report to Firestore:", err);
              queueCache.push(report);
              await idbSet("queue", queueCache);
            }
          }
        }
        if (syncCount > 0) {
          dbService.updateRateLimit(myId);
        }
      } else {
        const filteredQueue = toSync.filter(r => !dbService.isDeviceBanned(r.deviceId));
        filteredQueue.forEach(report => {
          if (!reportsCache.some(r => r.id === report.id)) {
            reportsCache.unshift(report);
          }
        });
        await idbSet("reports", reportsCache);
        syncCount += filteredQueue.length;
        if (filteredQueue.some(r => r.deviceId === myId)) {
          dbService.updateRateLimit(myId);
        }
      }
    }

    // 2. Sync queued chat messages
    let chatQueue = await idbGet("chat_queue") || [];
    if (chatQueue.length > 0) {
      const toSyncChat = [...chatQueue];
      chatQueue = [];
      await idbSet("chat_queue", []);

      if (isConfigured) {
        for (const msg of toSyncChat) {
          try {
            const { id, ...cleanMsg } = msg;
            await addDoc(collection(firestore, "chat_messages"), cleanMsg);
          } catch (err) {
            console.error("Failed syncing queued chat message:", err);
            chatQueue.push(msg);
            await idbSet("chat_queue", chatQueue);
          }
        }
      }
    }

    window.dispatchEvent(new CustomEvent("libya_report_synced"));
    return syncCount;
  },

  toggleUpvote: async (reportId, deviceId) => {
    const index = reportsCache.findIndex(r => r.id === reportId);
    if (index !== -1) {
      const r = { ...reportsCache[index] };
      r.upvotedDevices = r.upvotedDevices || [];
      const hasUpvoted = r.upvotedDevices.includes(deviceId);
      if (hasUpvoted) {
        r.upvotedDevices = r.upvotedDevices.filter(id => id !== deviceId);
      } else {
        r.upvotedDevices.push(deviceId);
      }
      r.upvotes = r.upvotedDevices.length;
      reportsCache[index] = r;
      await idbSet("reports", reportsCache);
      window.dispatchEvent(new CustomEvent("libya_report_new", { detail: r }));
    }

    if (isConfigured) {
      try {
        const report = reportsCache.find(r => r.id === reportId);
        if (!report) return null;

        const hasUpvoted = report.upvotedDevices && report.upvotedDevices.includes(deviceId);
        const docRef = doc(firestore, "reports", reportId);

        await updateDoc(docRef, {
          upvotedDevices: hasUpvoted ? arrayRemove(deviceId) : arrayUnion(deviceId),
          upvotes: hasUpvoted ? increment(-1) : increment(1)
        });
        return report;
      } catch (err) {
        console.error("Firestore upvote failed:", err);
        return null;
      }
    }

    return index !== -1 ? reportsCache[index] : null;
  },

  subscribeChatMessages: (callback) => {
    if (!isConfigured) {
      const handleOfflineChat = () => {
        const stored = JSON.parse(localStorage.getItem("libya_report_chat_messages") || "[]");
        callback(stored);
      };
      window.addEventListener("libya_report_offline_chat_update", handleOfflineChat);
      handleOfflineChat();
      return () => window.removeEventListener("libya_report_offline_chat_update", handleOfflineChat);
    }
    
    const q = query(
      collection(firestore, "chat_messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      callback(list);
    }, (err) => {
      console.error("Firestore chat listener error:", err);
    });
  },

  sendChatMessage: async (msgPayload) => {
    const tempId = "msg_" + Math.random().toString(36).substr(2, 9);
    const newMsg = {
      id: tempId,
      timestamp: Date.now(),
      ...msgPayload
    };

    if (!navigator.onLine) {
      // Add to offline chat queue
      let chatQueue = await idbGet("chat_queue") || [];
      chatQueue.push(newMsg);
      await idbSet("chat_queue", chatQueue);
      
      // Save locally to display it
      const stored = JSON.parse(localStorage.getItem("libya_report_chat_messages") || "[]");
      stored.push(newMsg);
      localStorage.setItem("libya_report_chat_messages", JSON.stringify(stored));
      window.dispatchEvent(new CustomEvent("libya_report_offline_chat_update"));
      return newMsg;
    }

    if (!isConfigured) {
      const stored = JSON.parse(localStorage.getItem("libya_report_chat_messages") || "[]");
      stored.push(newMsg);
      localStorage.setItem("libya_report_chat_messages", JSON.stringify(stored));
      window.dispatchEvent(new CustomEvent("libya_report_offline_chat_update"));
      return newMsg;
    }

    try {
      const { id, ...cleanMsg } = newMsg;
      const docRef = await addDoc(collection(firestore, "chat_messages"), cleanMsg);
      return { id: docRef.id, ...newMsg };
    } catch (err) {
      console.error("Firestore chat submission failed:", err);
      throw err;
    }
  },

  addPeerReport: async (peerReport) => {
    if (reportsCache.some(r => r.id === peerReport.id || r.ticketCode === peerReport.ticketCode)) {
      return false;
    }
    
    reportsCache.unshift(peerReport);
    await idbSet("reports", reportsCache);
    
    if (!queueCache.some(q => q.id === peerReport.id)) {
      queueCache.push(peerReport);
      await idbSet("queue", queueCache);
    }
    
    window.dispatchEvent(new CustomEvent("libya_report_new", { detail: reportsCache }));
    return true;
  },

  addPeerChatMessage: async (peerMsg) => {
    const stored = JSON.parse(localStorage.getItem("libya_report_chat_messages") || "[]");
    if (stored.some(m => m.id === peerMsg.id || (m.sender === peerMsg.sender && m.text === peerMsg.text && Math.abs(m.timestamp - peerMsg.timestamp) < 3000))) {
      return false;
    }
    stored.push(peerMsg);
    localStorage.setItem("libya_report_chat_messages", JSON.stringify(stored));
    
    let chatQueue = await idbGet("chat_queue") || [];
    if (!chatQueue.some(q => q.id === peerMsg.id)) {
      chatQueue.push(peerMsg);
      await idbSet("chat_queue", chatQueue);
    }
    
    window.dispatchEvent(new CustomEvent("libya_report_offline_chat_update"));
    return true;
  },

  getQueueCount: () => {
    return queueCache.length;
  }
};

