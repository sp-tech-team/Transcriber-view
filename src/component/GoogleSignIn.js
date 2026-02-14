import React, { useState, useEffect, useContext } from "react";
import { supabase } from "../supabase/supabaseClient";
import { AuthContext } from "../AuthContext";

export default function GoogleSignIn() {
  const { loading: authLoading } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Allowed domains and specific emails
  const ALLOWED_DOMAINS = ["sadhguru.org"];
  const ALLOWED_EMAILS = ["testing@gmail.com"];

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    sessionStorage.setItem("oauth_in_progress", "true");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid",
        redirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      sessionStorage.removeItem("oauth_in_progress");
    }
  };

  // ✅ Check if user cancelled OAuth
  useEffect(() => {
    const oauthInProgress = sessionStorage.getItem("oauth_in_progress");

    if (oauthInProgress === "true") {
      console.log("🔍 Checking if user returned from OAuth...");

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          console.log("⚠️ No session found - user likely cancelled OAuth");
          setLoading(false);
        }
        sessionStorage.removeItem("oauth_in_progress");
      });
    }
  }, []);

  // ✅ Check for deleted users AND validate domain/email
  const checkUserStatus = async (user) => {
    if (!user) return;

    try {
      const email = (user.email || "").toLowerCase().trim();
      const emailDomain = email.split("@")[1];

      console.log("🔍 Checking user:", email, "Domain:", emailDomain);

      // ✅ Check if email/domain is allowed
      const isAllowed =
        ALLOWED_DOMAINS.includes(emailDomain) || ALLOWED_EMAILS.includes(email);

      if (!isAllowed) {
        console.log("❌ Access denied for:", email);

        const errorMessage = `Access denied. The email "${email}" is not authorized. Allowed domains: ${ALLOWED_DOMAINS.join(
          ", "
        )}`;

        // Set error immediately
        setError(errorMessage);
        setLoading(false);

        // Also store in sessionStorage for persistence
        sessionStorage.setItem("loginError", errorMessage);

        // Sign out the unauthorized user
        await supabase.auth.signOut();
        return;
      }

      console.log("✅ Domain/email check passed for:", email);

      // ✅ Check if user is deleted in Supabase
      const { data, error: dbError } = await supabase
        .from("profiles")
        .select("deleted")
        .eq("id", user.id)
        .maybeSingle();

      if (dbError) {
        console.error("Error checking user status:", dbError);
        return;
      }

      // If user is deleted/banned
      if (data && data.deleted === true) {
        console.log("❌ Deleted user detected:", user.email);

        const errorMessage =
          "Your account has been deactivated. Please contact an administrator.";

        // Set error immediately
        setError(errorMessage);
        setLoading(false);

        // Also store in sessionStorage
        sessionStorage.setItem("loginError", errorMessage);

        // Sign out the banned user
        await supabase.auth.signOut();
        return;
      }

      console.log("✅ User status check passed for:", user.email);
      setLoading(false); // Allow login to proceed
    } catch (err) {
      console.error("Error in checkUserStatus:", err);
      setError("An error occurred during authentication. Please try again.");
      setLoading(false);
    }
  };

  // ✅ Check for stored error on mount and periodically
  useEffect(() => {
    const checkStoredError = () => {
      const storedError = sessionStorage.getItem("loginError");
      if (storedError) {
        console.log("📢 Found stored error:", storedError);
        setError(storedError);
        setLoading(false); // Ensure loading is false
        sessionStorage.removeItem("loginError");
      }
    };

    // Check immediately
    checkStoredError();

    // Also check after a delay (in case auth redirect is slow)
    const timer = setTimeout(checkStoredError, 1000);

    return () => clearTimeout(timer);
  }, []);

  // ✅ Check for error in URL parameters (from Supabase redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorDescription = urlParams.get("error_description");
    const errorCode = urlParams.get("error_code");

    if (errorDescription || errorCode) {
      console.log("❌ Error from URL:", errorDescription);

      let errorMessage = "Authentication failed. ";

      if (errorDescription?.includes("Database error")) {
        errorMessage =
          "Please contact the administrator OR Check if using authorized email";
      } else if (
        errorDescription?.includes("deleted") ||
        errorDescription?.includes("banned")
      ) {
        errorMessage =
          "Your account has been deactivated. Please contact an administrator.";
      } else if (errorDescription) {
        errorMessage += decodeURIComponent(errorDescription);
      }

      setError(errorMessage);
      setLoading(false);

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // ✅ Check current session on mount (for unauthorized users)
  useEffect(() => {
    const checkCurrentSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        console.log("🔍 Found existing session, checking authorization...");
        await checkUserStatus(session.user);
      }
    };

    checkCurrentSession();
  }, []);

  // ✅ Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔔 Auth event in GoogleSignIn:", event);
      console.log("📦 Session:", session ? "Present" : "None");

      if (event === "SIGNED_IN" && session?.user) {
        console.log("✅ User signed in:", session.user.email);
        await checkUserStatus(session.user);
      }

      if (event === "SIGNED_OUT") {
        console.log("🔴 User signed out");

        // DON'T set loading to false immediately
        // Check if there's an error to display first
        const storedError = sessionStorage.getItem("loginError");
        console.log("📢 Checking for stored error after signout:", storedError);

        if (storedError) {
          console.log("📢 Displaying stored error after signout");
          setError(storedError);
          setLoading(false);
          // Don't remove it yet - let the other useEffect handle it
        } else {
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        padding: "20px",
        background: "#fff",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "500px",
          background: "#fff",
          padding: "40px",
          borderRadius: "16px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        }}
      >
        {/* Logo or Icon */}
        <div
          style={{
            fontSize: "60px",
            marginBottom: "20px",
            animation: "float 3s ease-in-out infinite",
          }}
        >
          🎙️
        </div>

        <h2
          style={{
            marginBottom: "10px",
            color: "#840A16",
            fontSize: "28px",
            fontWeight: "700",
          }}
        >
          Welcome to Lekhani
        </h2>

        <p
          style={{
            marginBottom: "30px",
            color: "#666",
            fontSize: "14px",
          }}
        >
          Sign in with your authorized Google account
        </p>

        {/* ✅ Error Alert Box */}
        {error && (
          <div
            style={{
              backgroundColor: "#fee2e2",
              border: "2px solid #f87171",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "20px",
              color: "#991b1b",
              fontSize: "14px",
              lineHeight: "1.5",
              textAlign: "left",
            }}
          >
            <strong>⚠️ Access Denied</strong>
            <div style={{ marginTop: "8px" }}>{error}</div>
          </div>
        )}

        {authLoading ? (
          <div style={{ color: "#666", marginBottom: "20px" }}>
            <div
              style={{
                fontSize: "40px",
                marginBottom: "16px",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              🔐
            </div>
            Checking authentication...
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px 32px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: loading ? "#ccc" : "#4285F4",
              color: "#fff",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: loading
                ? "none"
                : "0 4px 12px rgba(66, 133, 244, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "#357ae8";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 6px 16px rgba(66, 133, 244, 0.5)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "#4285F4";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(66, 133, 244, 0.4)";
              }
            }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #fff",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Signing in...
              </>
            ) : (
              <>
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <g fill="none" fillRule="evenodd">
                    <path
                      d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
                      fill="#00008B"
                      // "#4285F4"
                    />
                    <path
                      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
                      fill="#34A853"
                    />
                    <path
                      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
                      fill="#EA4335"
                    />
                  </g>
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        )}

        {/* ✅ Info text */}
        <div
          style={{
            marginTop: "24px",
            padding: "12px",
            backgroundColor: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#0c4a6e",
            textAlign: "left",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <strong>ℹ️ Authorization:</strong> Only users with email addresses
            from <strong>{ALLOWED_DOMAINS.join(", ")}</strong> can access this
            application.
          </div>
          <div>
            <strong>Note:</strong> You may see "This app isn't verified" from
            Google. Click <strong>"Continue"</strong> to proceed. And please
            <strong> "tick check box"</strong> to allow spreadsheet access.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
