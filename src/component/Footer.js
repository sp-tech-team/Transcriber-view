import React from "react";

export default function Footer() {
  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        //background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        //borderTop: "1px solid #e2e8f0",
        padding: "14px 20px",
        textAlign: "center",
        fontSize: "13px",
        color: "#64748b",
        zIndex: 100,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        //boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            color: "#840A16",
            fontWeight: "600",
            letterSpacing: "0.5px",
          }}
        >
          LEKHANI
        </span>
        <span style={{ color: "#cbd5e1" }}>•</span>
        <span>© {new Date().getFullYear()} All rights reserved</span>
        <span style={{ color: "#cbd5e1" }}>•</span>
        <span
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#22c55e",
              animation: "pulse 2s infinite",
            }}
          />
          Powered by AI
        </span>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </footer>
  );
}
