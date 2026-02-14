import React, { useState, useEffect } from "react";
import { supabase } from "../supabase/supabaseClient";

export default function PermissionBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const hasSeenUpgrade = localStorage.getItem("seen_permission_upgrade_v2");
    if (!hasSeenUpgrade) {
      setShowBanner(true);
    }
  }, []);

  const dismissBanner = () => {
    localStorage.setItem("seen_permission_upgrade_v2", "true");
    setShowBanner(false);
  };

  const handleReauth = async () => {
    const confirmed = window.confirm(
      "You will be signed out and redirected to sign in again with the required permissions. Continue?"
    );

    if (confirmed) {
      try {
        // Mark as seen
        localStorage.setItem("seen_permission_upgrade_v2", "true");

        // ✅ CRITICAL: Set flag to force fresh consent on next login
        sessionStorage.setItem("force_consent", "true");

        // Get current session to revoke the token
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // ✅ Revoke the Google token (removes app access from Google account)
        if (session?.provider_token) {
          try {
            await fetch(
              `https://oauth2.googleapis.com/revoke?token=${session.provider_token}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
              }
            );
            console.log("✅ Google token revoked");
          } catch (err) {
            console.warn("Could not revoke Google token:", err);
          }
        }

        // Sign out from Supabase
        await supabase.auth.signOut();

        console.log("✅ Signed out - user will be redirected to login");
      } catch (error) {
        console.error("Error during re-authentication:", error);
        alert("Error signing out. Please try again.");
      }
    }
  };

  if (!showBanner) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: "#ff9800",
        color: "#fff",
        padding: "16px 20px",
        textAlign: "center",
        zIndex: 9999,
        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.3)",
        animation: "slideDown 0.4s ease-out",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}
        >
          ⚠️ Action Required: Permission Update Needed
        </div>
        <div style={{ fontSize: "14px", marginBottom: "12px", opacity: 0.95 }}>
          We've added new features that require access to Google Sheets. Please
          sign out and sign in again to grant the necessary permissions.
        </div>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleReauth}
            style={{
              backgroundColor: "#fff",
              color: "#ff9800",
              border: "none",
              padding: "10px 24px",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f5f5f5";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            🔄 Sign Out & Re-authenticate
          </button>
          <button
            onClick={dismissBanner}
            style={{
              backgroundColor: "transparent",
              color: "#fff",
              border: "2px solid #fff",
              padding: "10px 24px",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
