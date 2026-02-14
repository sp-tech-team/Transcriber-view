import React from "react";

export default function PageTitle() {
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      gap: "16px",
      padding: "20px 0"
    }}>
      <div style={{ 
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/lekhani_logo4.png"
            alt="Lekhani Logo"
            style={{ 
              width: "48px", 
              height: "48px",
              objectFit: "contain",
              filter: "drop-shadow(0 2px 4px rgba(132, 10, 22, 0.2))"
            }}
          />
          <h1 style={{ 
            fontSize: "28px", 
            fontWeight: "700",
            fontFamily: "Raleway, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            background: "linear-gradient(135deg, #840A16 0%, #C41E3A 50%, #FF5733 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            margin: 0,
            letterSpacing: "1px",
            textShadow: "0 2px 4px rgba(132, 10, 22, 0.1)"
          }}>
            LEKHANI
          </h1>
        </div>
        
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#64748b",
          fontWeight: "500",
          letterSpacing: "0.5px"
        }}>
          <div style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "linear-gradient(45deg, #22c55e, #16a34a)",
            boxShadow: "0 0 8px rgba(34, 197, 94, 0.4)"
          }} />
          <span>AI-Powered Transcription</span>
        </div>
      </div>
    </div>
  );
}