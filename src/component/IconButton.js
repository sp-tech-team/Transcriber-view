import React, { useState } from "react";

export default function IconButton({ onClick, label, icon, disabled = false }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const buttonStyle = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "56px",
    height: "56px",
    fontSize: "24px",
    background: disabled 
      ? "linear-gradient(145deg, #f1f5f9, #e2e8f0)"
      : "linear-gradient(145deg, #ffffff, #f8fafc)",
    border: `2px solid ${disabled ? "#e2e8f0" : "#e1e5e9"}`,
    borderRadius: "16px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    opacity: disabled ? 0.6 : 1,
    boxShadow: disabled 
      ? "inset 0 2px 4px rgba(0, 0, 0, 0.06)"
      : isPressed 
        ? "inset 0 2px 6px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05)"
        : isHovered
          ? "0 8px 25px rgba(132, 10, 22, 0.15), 0 3px 10px rgba(0, 0, 0, 0.08)"
          : "0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)",
    transform: disabled 
      ? "none"
      : isPressed 
        ? "translateY(1px) scale(0.95)"
        : isHovered 
          ? "translateY(-2px) scale(1.02)"
          : "translateY(0) scale(1)",
  };

  const tooltipStyle = {
    position: "absolute",
    bottom: "70px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #1f2937, #374151)",
    color: "#f9fafb",
    fontSize: "12px",
    fontWeight: "500",
    padding: "8px 12px",
    borderRadius: "8px",
    whiteSpace: "nowrap",
    opacity: isHovered && !disabled ? 1 : 0,
    visibility: isHovered && !disabled ? "visible" : "hidden",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    pointerEvents: "none",
    zIndex: 1000,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };

  // Arrow for tooltip
  const arrowStyle = {
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "0",
    height: "0",
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderTop: "5px solid #374151",
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        style={buttonStyle}
        onClick={disabled ? undefined : onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onMouseDown={() => !disabled && setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        disabled={disabled}
        aria-label={label}
      >
        <span style={{ 
          filter: disabled ? "grayscale(100%)" : "none",
          transition: "filter 0.2s ease"
        }}>
          {icon}
        </span>
      </button>
      
      <div style={tooltipStyle}>
        {label}
        <div style={arrowStyle} />
      </div>
    </div>
  );
}