import React, { useState, useEffect, useContext } from "react";
import Transcriber from "./Transcriber";
import QuestionRecorder from "./QuestionRecorder";
import { AuthProvider, AuthContext } from "./AuthContext";
import GoogleSignIn from "./component/GoogleSignIn";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// ✅ Splash Screen Component
function SplashScreen() {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        backgroundImage: "url('/launch3.png')",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#EBD8B7",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        animation: "fadeInOut 3s ease-in-out forwards",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <style>
        {`
        @keyframes fadeInOut {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}
      </style>
    </div>
  );
}

// ✅ Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#840A16",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "40px",
              marginBottom: "16px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            🎤
          </div>
          Loading...
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }
        `}</style>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ✅ Public Route (redirect to home if already logged in)
function PublicRoute({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#840A16",
        }}
      >
        Loading...
      </div>
    );
  }

  // If already logged in, redirect to home
  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// ✅ App Content (shows after splash)
function AppContent() {
  return (
    <div style={{ padding: "10px" }}>
      <Routes>
        {/* ✅ Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Transcriber />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lekhani/:category"
          element={
            <ProtectedRoute>
              <QuestionRecorder />
            </ProtectedRoute>
          }
        />

        {/* ✅ Public Route (Login) */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <GoogleSignIn />
            </PublicRoute>
          }
        />

        {/* ✅ Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// ✅ Main App Component with Splash Screen
function App() {
  // ✅ Use a ref-like approach to ensure splash only shows once per app mount
  // const [showSplash, setShowSplash] = useState(() => {
  //   const splashShown = sessionStorage.getItem("splashShown");
  //   return splashShown !== "true";
  // });

  const [showSplash, setShowSplash] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);

  useEffect(() => {
    // Wait for splash animation to complete (3 seconds)
    const timer = setTimeout(() => {
      setSplashComplete(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []); // Empty array = runs only once when App mounts

  return (
    <Router>
      <AuthProvider>
        {/* Show splash only if it hasn't been shown and isn't complete */}
        {showSplash && !splashComplete && <SplashScreen />}

        {/* Always render AppContent, but hide it during splash */}
        <div
          style={{
            visibility: showSplash && !splashComplete ? "hidden" : "visible",
            height: showSplash && !splashComplete ? 0 : "auto",
            overflow: showSplash && !splashComplete ? "hidden" : "visible",
          }}
        >
          <AppContent />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
