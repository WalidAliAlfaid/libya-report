import React from "react";

export default function AppLogo({ size = 28, style = {} }) {
  return (
    <img
      src="/logo.png"
      alt="Libya Report Logo"
      width={size}
      height={size}
      style={{
        display: "block",
        objectFit: "contain",
        borderRadius: "22%", // Elegant rounded squircle border matching modern app icons
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
        background: "#ffffff", // Clean white background inside the app matching launcher
        border: "1.5px solid rgba(255, 255, 255, 0.1)",
        ...style
      }}
    />
  );
}
