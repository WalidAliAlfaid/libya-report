import React, { useState } from "react";
import { strings } from "../locales/strings";
import { showToast } from "./NotificationToast";

const MOCK_PHOTOS = [
  "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80"
];

const CAT_META = {
  electricity: { emoji:"⚡", bg:"rgba(212,168,83,0.15)", clr:"#d4a853" },
  flooding:    { emoji:"🌊", bg:"rgba(59,130,246,0.15)",  clr:"#3b82f6" },
  streetlight: { emoji:"💡", bg:"rgba(234,179,8,0.15)",   clr:"#eab308" },
  waterLeak:   { emoji:"💧", bg:"rgba(6,182,212,0.15)",   clr:"#06b6d4" },
  other:       { emoji:"⚠️", bg:"rgba(139,92,246,0.15)",  clr:"#8b5cf6" },
};

export default function ReportModal({ lang, category, coords, onClose, onSubmit }) {
  const [desc, setDesc]           = useState("");
  const [photo, setPhoto]         = useState(null);
  const [video, setVideo]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio]         = useState(null);
  const [timeLeft, setTimeLeft]   = useState(10);

  const recorderRef = React.useRef(null);
  const timerRef = React.useRef(null);
  const streamRef = React.useRef(null);

  const t  = strings[lang];
  const cm = CAT_META[category] || CAT_META.other;

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudio(reader.result);
          showToast(t.audioAttached, "success");
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setTimeLeft(10);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error(err);
      showToast(lang === "en" ? "Microphone access denied." : "تم رفض الوصول للميكروفون.", "error");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onloadend = () => setPhoto(r.result);
    r.readAsDataURL(f);
  };

  const handleVideoFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      showToast(lang === "en" ? "Video must be smaller than 10MB." : "يجب أن يكون حجم الفيديو أقل من 10 ميجابايت.", "error");
      return;
    }
    const r = new FileReader();
    r.onloadend = () => {
      setVideo(r.result);
      showToast(lang === "en" ? "Video attached!" : "تم إرفاق الفيديو!", "success");
    };
    r.readAsDataURL(f);
  };

  const handleMockSnap = () => {
    setPhoto(MOCK_PHOTOS[Math.floor(Math.random() * MOCK_PHOTOS.length)]);
    showToast(lang==="en"?"Photo attached!":"تم إرفاق الصورة!","success");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!desc.trim() && !audio) {
      showToast(lang === "en" ? "Add a description or record a voice report first." : "أضف وصفاً أو سجل تقريراً صوتياً أولاً.", "warning");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      try {
        onSubmit({
          category,
          description: desc,
          audio,
          lat: coords.lat,
          lng: coords.lng,
          photo,
          video
        });
      } finally {
        setSubmitting(false);
      }
    }, 1000);
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-panel" dir={t.direction} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-inner">

          {/* Category header */}
          <div className="modal-cat-header">
            <div className="modal-cat-icon" style={{ background: cm.bg }}>
              {cm.emoji}
            </div>
            <div>
              <div className="modal-cat-label" style={{ color: cm.clr }}>{t[category] || category}</div>
              <div className="modal-cat-coords">📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Description */}
            <div className="field">
              <label className="field-lbl">{t.description}</label>
              <textarea
                className="field-ta"
                rows={4}
                placeholder={t.descriptionPlaceholder}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                disabled={submitting}
                style={{ minHeight:"110px" }}
              />
            </div>

            {/* Voice Report */}
            <div className="field">
              <label className="field-lbl">{t.voiceReport}</label>
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed var(--border-subtle)",
                borderRadius: "var(--r-md)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                position: "relative"
              }}>
                {recording ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "var(--clr-red)",
                      animation: "lr-pulse 1s infinite alternate"
                    }} />
                    <span style={{ fontSize: "0.85rem", color: "var(--clr-red)", fontWeight: 700 }}>
                      {t.recordingActive} ({timeLeft}{t.secondsRemaining})
                    </span>
                    <button
                      type="button"
                      onClick={stopRecording}
                      style={{
                        padding: "6px 14px",
                        background: "rgba(244,63,94,0.15)",
                        color: "var(--clr-red)",
                        border: "1px solid rgba(244,63,94,0.3)",
                        borderRadius: "var(--r-pill)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      {t.stopRecording}
                    </button>
                  </div>
                ) : audio ? (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                    <audio src={audio} controls style={{ width: "100%", height: "40px", borderRadius: "var(--r-md)" }} />
                    <button
                      type="button"
                      onClick={() => setAudio(null)}
                      style={{
                        background: "transparent",
                        color: "var(--tx-3)",
                        border: "none",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline"
                      }}
                    >
                      {t.deleteAudio}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={submitting}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 20px",
                      background: "rgba(212,168,83,0.1)",
                      color: "var(--gold-400)",
                      border: "1px solid rgba(212,168,83,0.3)",
                      borderRadius: "var(--r-pill)",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.18s ease"
                    }}
                  >
                    <span>🎤</span>
                    <span>{t.startRecording}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Photo */}
            <div className="field">
              <label className="field-lbl">{t.photo}</label>
              <div className="photo-grid">
                {photo ? (
                  <div className="photo-preview">
                    <img src={photo} alt="preview" />
                    <button type="button" className="photo-remove" onClick={() => setPhoto(null)}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="photo-pick">
                      <span className="ico">🖼️</span>
                      <span>{t.uploadPhoto}</span>
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile} disabled={submitting}/>
                    </label>
                    <button type="button" className="photo-pick" onClick={handleMockSnap} disabled={submitting}>
                      <span className="ico">📷</span>
                      <span>{t.snapPhoto}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Video */}
            <div className="field">
              <label className="field-lbl">{lang === "ar" ? "فيديو البلاغ (اختياري)" : "Report Video (Optional)"}</label>
              <div className="photo-grid">
                {video ? (
                  <div className="photo-preview" style={{ position: "relative" }}>
                    <video src={video} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }} />
                    <button type="button" className="photo-remove" onClick={() => setVideo(null)}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="photo-pick" style={{ flex: 1 }}>
                      <span className="ico">🎥</span>
                      <span>{lang === "ar" ? "رفع فيديو" : "Upload Video"}</span>
                      <input type="file" accept="video/*" style={{ display:"none" }} onChange={handleVideoFile} disabled={submitting}/>
                    </label>
                    <label className="photo-pick" style={{ flex: 1 }}>
                      <span className="ico">📹</span>
                      <span>{lang === "ar" ? "تسجيل فيديو" : "Record Video"}</span>
                      <input type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={handleVideoFile} disabled={submitting}/>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop:"1px solid var(--border-subtle)", margin:"20px 0" }} />

            <div className="btn-row">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={submitting} style={{ flex:1 }}>
                {t.close}
              </button>
              <button type="submit" className="btn-submit" disabled={submitting} style={{ flex:2 }}>
                {submitting ? <><span className="spinner"/>{ t.submitting}</> : t.submit}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
