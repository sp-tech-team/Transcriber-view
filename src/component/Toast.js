import React, { useEffect, useState } from "react";

const Toast = ({ 
  message, 
  duration = 3000, 
  onClose, 
  type = "success" // success, error, warning, info
}) => {
  const [visible, setVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const getToastStyles = () => {
    const baseStyles = {
      position: "fixed",
      top: "24px",
      right: "24px",
      minWidth: "320px",
      maxWidth: "400px",
      padding: "16px 20px",
      borderRadius: "12px",
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 5px 10px rgba(0, 0, 0, 0.05)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      gap: "12px",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      fontSize: "14px",
      fontWeight: "500",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: isExiting 
        ? "translateX(100%) scale(0.95)" 
        : visible 
          ? "translateX(0) scale(1)" 
          : "translateX(100%) scale(0.95)",
      opacity: isExiting ? 0 : visible ? 1 : 0,
    };

    const typeStyles = {
      success: {
        background: "linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))",
        color: "#ffffff",
        border: "1px solid rgba(34, 197, 94, 0.3)",
      },
      error: {
        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))",
        color: "#ffffff",
        border: "1px solid rgba(239, 68, 68, 0.3)",
      },
      warning: {
        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))",
        color: "#ffffff",
        border: "1px solid rgba(245, 158, 11, 0.3)",
      },
      info: {
        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))",
        color: "#ffffff",
        border: "1px solid rgba(59, 130, 246, 0.3)",
      },
    };

    return { ...baseStyles, ...typeStyles[type] };
  };

  const getIcon = () => {
    const iconStyles = {
      fontSize: "18px",
      flexShrink: 0,
    };

    const icons = {
      success: <span style={iconStyles}>✓</span>,
      error: <span style={iconStyles}>✕</span>,
      warning: <span style={iconStyles}>⚠</span>,
      info: <span style={iconStyles}>ℹ</span>,
    };

    return icons[type] || icons.info;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, 300); // Wait for exit animation
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  if (!visible && !isExiting) return null;

  return (
    <div style={getToastStyles()}>
      {getIcon()}
      <span style={{ 
        flex: 1, 
        whiteSpace: "pre-line",
        lineHeight: "1.4"
      }}>
        {message}
      </span>
      <button
        onClick={handleClose}
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontSize: "16px",
          padding: "2px",
          opacity: 0.8,
          transition: "opacity 0.2s ease",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "20px",
          height: "20px",
        }}
        onMouseEnter={(e) => e.target.style.opacity = 1}
        onMouseLeave={(e) => e.target.style.opacity = 0.8}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;