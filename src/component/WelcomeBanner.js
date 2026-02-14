import React, { useContext } from "react";
import { AuthContext } from "../AuthContext";

export default function WelcomeBanner() {
  const { user, logout } = useContext(AuthContext);

  if (!user) return null; // Don't render if no user is logged in

  const displayName = user.user_metadata?.full_name || user.email;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #840A16, #A91827)",
        color: "#fff",
        padding: "14px 20px",
        borderRadius: "12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
        marginBottom: "3px",
        marginTop: "40px",
        marginLeft: "60px",
        marginRight: "60px",
      }}
    >
      <span style={{ fontSize: "16px", fontWeight: "500" }}>
        Namaskaram 🙏, <strong>{displayName}</strong>
      </span>
      <button
        onClick={logout}
        style={{
          padding: "8px 16px",
          border: "none",
          borderRadius: "8px",
          backgroundColor: "#fff",
          color: "#840A16",
          cursor: "pointer",
          fontWeight: "600",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#f5f5f5";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#fff";
        }}
      >
        Logout
      </button>
    </div>
  );
}
