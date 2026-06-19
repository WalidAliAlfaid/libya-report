import React, { useState } from "react";
import { strings } from "../locales/strings";

const HOTLINE_DATA = {
  national: [
    {
      name_en: "Ambulance & Emergency Medical Support",
      name_ar: "مركز طب الطوارئ والدعم الموحد",
      number: "1412",
      source_en: "Emergency Medicine and Support Center (EMSC), 2026 Portal",
      source_ar: "البوابة الرسمية لمركز طب الطوارئ والدعم، 2026"
    },
    {
      name_en: "National Civil Defense & Safety",
      name_ar: "الهيئة الوطنية للسلامة الوطنية (الدفاع المدني)",
      number: "1515",
      source_en: "National Safety Authority Security Bulletin, 2026",
      source_ar: "الهيئة الوطنية للسلامة الوطنية، نشرة الأمن 2026"
    },
    {
      name_en: "Public Safety & Incident Hotline",
      name_ar: "رقم البلاغات الأمنية الموحد",
      number: "192",
      source_en: "Ministry of Interior Public Safety Department, 2026",
      source_ar: "وزارة الداخلية، إدارة السلامة العامة 2026"
    }
  ],
  cities: {
    tripoli: [
      {
        name_en: "GECOL Electricity Outage (Tripoli & West)",
        name_ar: "طوارئ الكهرباء - المنطقة الغربية وطرابلس",
        number: "+218 21 480 0956",
        source_en: "GECOL Central Communications Registry, 2026",
        source_ar: "الشركة العامة للكهرباء (GECOL)، سجل الاتصالات المركزي 2026"
      },
      {
        name_en: "Red Crescent (Tripoli)",
        name_ar: "الهلال الأحمر الليبي - فرع طرابلس",
        number: "+218 21 333 1908",
        source_en: "Libyan Red Crescent Official Directory",
        source_ar: "جمعية الهلال الأحمر الليبي، الدليل الرسمي"
      }
    ],
    benghazi: [
      {
        name_en: "GECOL Electricity Outage (Benghazi & East)",
        name_ar: "طوارئ الكهرباء - المنطقة الشرقية وبنغازي",
        number: "061 223 0213",
        source_en: "Ministry of Electricity Eastern Executive Bulletin, 2026",
        source_ar: "وزارة الكهرباء والطاقة المتجددة، النشرة التنفيذية 2026"
      },
      {
        name_en: "GECOL Mobile Emergency (Benghazi)",
        name_ar: "طوارئ الكهرباء المحمول - بنغازي",
        number: "094 623 4395",
        source_en: "Ministry of Electricity Eastern Region announcements, 2026",
        source_ar: "وزارة الكهرباء والطاقة المتجددة، إعلانات المنطقة الشرقية 2026"
      },
      {
        name_en: "Red Crescent (Benghazi)",
        name_ar: "الهلال الأحمر الليبي - فرع بنغازي",
        number: "092 234 2020",
        source_en: "Libyan Red Crescent Official Directory",
        source_ar: "جمعية الهلال الأحمر الليبي، الدليل الرسمي"
      }
    ],
    sebha: [
      {
        name_en: "GECOL Electricity Outage (Sebha & South)",
        name_ar: "طوارئ الكهرباء - المنطقة الجنوبية وسبها",
        number: "092 897 9782",
        source_en: "GECOL Southern District Crisis Committee, 2026",
        source_ar: "الشركة العامة للكهرباء، لجنة الأزمات بالمنطقة الجنوبية 2026"
      },
      {
        name_en: "GECOL Southern Emergency Alternator",
        name_ar: "طوارئ الكهرباء البديل - سبها",
        number: "091 401 2151",
        source_en: "GECOL Southern District Crisis Committee, 2026",
        source_ar: "الشركة العامة للكهرباء، لجنة الأزمات بالمنطقة الجنوبية 2026"
      }
    ]
  }
};

export default function HotlinesModal({ lang, onClose }) {
  const [selectedCity, setSelectedCity] = useState("all");
  const t = strings[lang];

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-panel" dir={strings[lang].direction} onClick={e => e.stopPropagation()} style={{ maxWidth: "480px" }}>
        <div className="modal-handle" />
        <div className="modal-inner">
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
              📞
            </div>
            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>
                {lang === "en" ? "Emergency Hotlines (2026)" : "أرقام الطوارئ الرسمية (2026)"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--tx-3)", marginTop: "2px" }}>
                {lang === "en" ? "Fast access to official Libyan emergency hotlines" : "وصول سريع لأرقام الطوارئ والكهرباء الرسمية في ليبيا"}
              </div>
            </div>
          </div>

          {/* City Filter */}
          <div className="field" style={{ marginBottom: "18px" }}>
            <label className="field-lbl">{lang === "en" ? "Filter by City" : "تصفية حسب المدينة"}</label>
            <select className="f-select" value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={{ width: "100%" }}>
              <option value="all">{lang === "en" ? "All Libya Services" : "كل خدمات ليبيا"}</option>
              <option value="tripoli">{lang === "en" ? "Tripoli & Western Region" : "طرابلس والمنطقة الغربية"}</option>
              <option value="benghazi">{lang === "en" ? "Benghazi & Eastern Region" : "بنغازي والمنطقة الشرقية"}</option>
              <option value="sebha">{lang === "en" ? "Sebha & Southern Region" : "سبها والمنطقة الجنوبية"}</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "50vh", overflowY: "auto", paddingRight: "4px" }}>
            
            {/* National Numbers */}
            {(selectedCity === "all") && (
              <>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--gold-400)", letterSpacing: "0.5px", marginBottom: "4px" }}>
                  {lang === "en" ? "National Emergency Services" : "خدمات الطوارئ الوطنية"}
                </div>
                {HOTLINE_DATA.national.map((item, idx) => (
                  <div key={idx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{lang === "en" ? item.name_en : item.name_ar}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--tx-3)" }}>
                        {lang === "en" ? `Source: ${item.source_en}` : `المصدر: ${item.source_ar}`}
                      </span>
                    </div>
                    <a href={`tel:${item.number}`} style={{ padding: "8px 16px", background: "rgba(34,197,94,0.15)", color: "var(--clr-green)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "var(--r-pill)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 800 }}>
                      📞 {item.number}
                    </a>
                  </div>
                ))}
              </>
            )}

            {/* City Specific */}
            {Object.keys(HOTLINE_DATA.cities).map((cityKey) => {
              if (selectedCity !== "all" && selectedCity !== cityKey) return null;
              return (
                <React.Fragment key={cityKey}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--gold-400)", letterSpacing: "0.5px", marginTop: "8px", marginBottom: "4px" }}>
                    {cityKey === "tripoli" ? (lang === "en" ? "Tripoli & West" : "طرابلس والمنطقة الغربية") :
                     cityKey === "benghazi" ? (lang === "en" ? "Benghazi & East" : "بنغازي والمنطقة الشرقية") :
                     (lang === "en" ? "Sebha & South" : "سبها والمنطقة الجنوبية")}
                  </div>
                  {HOTLINE_DATA.cities[cityKey].map((item, idx) => (
                    <div key={idx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{lang === "en" ? item.name_en : item.name_ar}</span>
                        <span style={{ fontSize: "0.68rem", color: "var(--tx-3)" }}>
                          {lang === "en" ? `Source: ${item.source_en}` : `المصدر: ${item.source_ar}`}
                        </span>
                      </div>
                      <a href={`tel:${item.number}`} style={{ padding: "8px 16px", background: "rgba(245,158,11,0.15)", color: "var(--clr-amber)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "var(--r-pill)", textDecoration: "none", fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                        📞 {item.number}
                      </a>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}

          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "20px 0 10px" }} />

          <button className="btn-ghost" onClick={onClose} style={{ width: "100%" }}>
            {lang === "en" ? "Close" : "إغلاق"}
          </button>

        </div>
      </div>
    </div>
  );
}
