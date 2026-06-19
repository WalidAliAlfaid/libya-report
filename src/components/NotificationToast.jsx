import React, { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, WifiOff, Info } from "lucide-react";

export function showToast(message, type = "info") {
  window.dispatchEvent(new CustomEvent("libya_report_toast", {
    detail: { message, type, id: Math.random().toString(36).substr(2, 9) }
  }));
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { message, type, id } = e.detail;
      setToasts(p => [...p, { message, type, id }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    };
    window.addEventListener("libya_report_toast", handler);
    return () => window.removeEventListener("libya_report_toast", handler);
  }, []);

  const icon = (type) => {
    if (type === "success") return <CheckCircle size={16} color="var(--green)" />;
    if (type === "error")   return <AlertTriangle size={16} color="var(--red)" />;
    if (type === "warning") return <AlertTriangle size={16} color="var(--amber)" />;
    if (type === "offline") return <WifiOff size={16} color="var(--text-2)" />;
    return <Info size={16} color="var(--gold)" />;
  };

  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {icon(t.type)}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
