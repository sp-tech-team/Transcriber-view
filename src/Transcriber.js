import React, { useState, useRef, useEffect, useContext } from "react";
import { backendURL } from "./config";
import IconButton from "./component/IconButton";
import Footer from "./component/Footer";
import Navbar from "./NavBar";
import { useLocation } from "react-router-dom";
import HelpFAQ from "./component/HelpFAQ2";
//import RecordingIndicator from "./component/RecordingIndicator";
import useUnsavedChangesGuard from "./Hook/useUnsavedChangesGuard";
import { AuthContext } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import WelcomeBanner from "./component/WelcomeBanner";

// Enhanced toolbar styles
const toolbarStyles = {
  card: {
    width: 280,
    padding: "20px",
    borderRadius: 16,
    background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)",
  },
  title: {
    fontWeight: 700,
    fontSize: 15,
    color: "#840A16",
    letterSpacing: "0.8px",
    margin: "0 0 16px",
    textTransform: "uppercase",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    alignItems: "center",
  },
  divider: {
    height: 1,
    background: "linear-gradient(90deg, transparent, #e5e7eb, transparent)",
    margin: "16px 0 12px",
  },
};

export default function Transcriber() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login"); // 🚨 redirect if not logged in
    }
  }, [user, navigate]);

  //console.log("Current User", user.user_metadata.full_name);

  const [statusLog, setStatusLog] = useState(["System ready"]);
  const [rawTranscript, setRawTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const location = useLocation();

  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentTab = pathParts[pathParts.length - 1] || "Basic Transcriber";

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const fileInputRef = useRef(null);

  const [faqOpen, setFaqOpen] = useState(false);

  const [canRecord, setCanRecord] = useState(true);
  const [canUpload, setCanUpload] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [recordingStream, setRecordingStream] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [transcriptionProgress, setTranscriptionProgress] = useState(0);

  const isDirty = finalTranscript.trim() !== "";

  // 🔒 Activate guard
  useUnsavedChangesGuard(isDirty);

  //Mobile display
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  //Debugging for mic Not working
  useEffect(() => {
    console.log("Protocol:", window.location.protocol);
    console.log("Navigator.mediaDevices:", navigator.mediaDevices);
    console.log(
      "getUserMedia available:",
      !!navigator?.mediaDevices?.getUserMedia
    );
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Add pulse styles
  const pulseStyle = (color) => ({
    display: "inline-block",
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: color,
    marginRight: "8px",
    animation: "pulse 1.5s infinite",
  });

  // Add keyframes for pulse
  const globalStyle = `
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.6; }
  100% { transform: scale(1); opacity: 1; }
}
`;

  // Inject CSS once
  useEffect(() => {
    if (!document.getElementById("pulse-style")) {
      const style = document.createElement("style");
      style.id = "pulse-style";
      style.innerHTML = globalStyle;
      document.head.appendChild(style);
    }
  }, []);

  // Auto-clear status messages after 3 seconds
  useEffect(() => {
    if (
      statusLog.length > 0 &&
      statusLog[statusLog.length - 1] !== "System ready"
    ) {
      const latestMessage = statusLog[statusLog.length - 1];
      setCurrentMessage(latestMessage);

      const timer = setTimeout(() => {
        setCurrentMessage("");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [statusLog]);

  useEffect(() => {
    const eventSource = new EventSource(`${backendURL}/status-stream`);
    eventSource.onmessage = (event) => {
      setStatusLog((prev) => [...prev, event.data]);
    };
    eventSource.onerror = () => {
      setStatusLog((prev) => [...prev, "Connection interrupted"]);
      eventSource.close();
    };
    return () => eventSource.close();
  }, []);

  const startRecording = async () => {
    try {
      // ✅ Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Microphone access is not supported. Please use HTTPS or check browser permissions."
        );
      }

      setStatusLog((prev) => [...prev, "🎙 Recording started..."]);
      setIsProcessing(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream); // pass to waveform

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      setCanUpload(false); // 🔴 disable upload during record
    } catch (err) {
      // ✅ Handle errors properly
      console.error("Error starting recording:", err);
      setStatusLog((prev) => [
        ...prev,
        `❌ Error starting recording: ${err.message}`,
      ]);
      setIsProcessing(false);
      setRecording(false);
    }
  };

  const stopRecording = () => {
    setStatusLog((prev) => [
      ...prev,
      "⏹ Recording stopped",
      "⏳ Processing...",
    ]);
    mediaRecorderRef.current.onstop = handleRecordingStop;
    mediaRecorderRef.current.stop();
    // stop the mic stream
    recordingStream?.getTracks().forEach((t) => t.stop());
    setRecordingStream(null);
    setRecording(false);
  };

  const handleRecordingStop = async () => {
    const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
    await sendToBackend(audioBlob);
    setCanUpload(true); // ✅ re-enable after transcription done
  };

  const uploadFile = async (e) => {
    setUploading(true);
    try {
      const file = e.target.files[0];
      if (!file) {
        setStatusLog((prev) => [...prev, "⚠️ No file selected"]);
        return;
      }

      // 🔒 Prevent empty file upload
      if (file.size === 0) {
        setStatusLog((prev) => [...prev, "⚠️ File is empty"]);
        return;
      }

      // 🎵 Allow only audio MIME types (you can extend)
      if (!file.type.startsWith("audio/")) {
        setStatusLog((prev) => [...prev, "⚠️ Not a valid audio file"]);
        return;
      }

      setCanRecord(false); // 🔴 disable record while uploading
      setStatusLog((prev) => [...prev, `📤 Uploading: ${file.name}...`]);

      await sendToBackend(file);

      setStatusLog((prev) => [
        ...prev,
        `✅ Uploaded & processed: ${file.name}`,
      ]);
      setCanRecord(true); // ✅ re-enable after transcription
    } catch (err) {
      setStatusLog((prev) => [...prev, `❌ Upload failed: ${err.message}`]);
    } finally {
      setUploading(false); // hide indicator once done
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const sendToBackend = async (audioBlob) => {
    // Add "Processing..." to status log
    setStatusLog((prev) => [...prev, "⏳ Processing..."]);

    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    try {
      const res = await fetch(`${backendURL}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      const data = await res.json();

      const transcriptText = data.text || "";
      setRawTranscript(transcriptText);
      setFinalTranscript(transcriptText);

      // Remove "Processing..." from status log
      setStatusLog((prev) => prev.filter((msg) => msg !== "⏳ Processing..."));

      if (transcriptText) {
        setStatusLog((prev) => [...prev, "✅ Transcription ready"]);
      }
    } catch (err) {
      // Remove "Processing..." in case of error
      setStatusLog((prev) => prev.filter((msg) => msg !== "⏳ Processing..."));
      setStatusLog((prev) => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setTranscribing(false);
      setIsProcessing(false);
    }
  };

  const saveToFile = () => {
    const userFileName = prompt("Save as:", "Lekhani_Transcription");
    if (!userFileName) return;

    const timestamp = new Date().toLocaleString();
    const content = `Transcription saved on: ${timestamp}\n\nTranscribed text: ${finalTranscript}`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${userFileName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setStatusLog(["System ready"]);
    setRawTranscript("");
    setFinalTranscript("");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
      }}
    >
      {/* ✅ MOBILE VIEW */}
      {isMobile ? (
        <>
          {/* Top bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              background: "#fff",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <img src="/lekhani_logo4.png" alt="logo" style={{ height: 36 }} />
            <button
              style={{
                background: "transparent",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
              }}
              onClick={() => setFaqOpen(true)}
            >
              ☰
            </button>
          </div>

          {/* Action buttons row */}
          <div
            style={{
              display: "flex",
              overflowX: "auto",
              gap: 12,
              padding: "12px",
              background: "#fafafa",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <IconButton
              onClick={recording ? stopRecording : startRecording}
              label={recording ? "Stop" : "Record"}
              icon={recording ? "⏹️" : "▶️"}
              disabled={transcribing || !canRecord}
            />
            <IconButton
              onClick={handleUploadClick}
              label="Upload"
              icon="📁"
              disabled={transcribing || !canUpload}
            />
            <IconButton
              onClick={saveToFile}
              label="Save"
              icon="💾"
              disabled={!finalTranscript}
            />
            <IconButton onClick={clearAll} label="Clear" icon="❌" />
          </div>

          {/* Mobile Status Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 16px",
              fontSize: "14px",
            }}
          >
            {recording && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "#dc2626",
                }}
              >
                <span style={pulseStyle("#dc2626")} />
                Recording...
              </div>
            )}
            {uploading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "#2563eb",
                }}
              >
                <span style={pulseStyle("#2563eb")} />
                Uploading...
              </div>
            )}
            {isProcessing && !recording && !uploading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "#16a34a",
                }}
              >
                <span style={pulseStyle("#16a34a")} />
                Transcribing...
              </div>
            )}
          </div>

          {/* Transcript area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center", // horizontal center
              alignItems: "center", // vertical center
              padding: "16px",
            }}
          >
            <textarea
              value={finalTranscript}
              onChange={(e) => setFinalTranscript(e.target.value)}
              placeholder="Start recording or upload audio..."
              style={{
                width: "90%", // shrink a little so it’s not edge-to-edge
                maxWidth: "700px", // optional, looks better on big screens
                height: "calc(100vh - 240px)", // adjust for header/buttons/footer
                padding: "10px",
                border: "2px solid #e5e7eb",
                borderRadius: "12px",
                fontSize: "16px",
                lineHeight: "1.5",
                fontFamily: "'Georgia', serif",
                resize: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <Footer />

          {/* ✅ Mobile Drawer Menu */}
          {faqOpen && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0,0,0,0.5)",
                zIndex: 999,
              }}
              onClick={() => setFaqOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: "100%",
                  maxHeight: "80vh",
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
                  animation: "slideUp 0.3s ease",
                  overflowY: "auto",
                }}
              >
                {/* Close button */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    padding: "12px 16px",
                  }}
                >
                  <button
                    onClick={() => setFaqOpen(false)}
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    ❌
                  </button>
                </div>

                {/* Navbar links */}
                <div style={{ padding: "0 20px 20px" }}>
                  <Navbar />
                </div>

                {/* FAQ content */}
                <div style={{ padding: "0 20px 20px" }}>
                  <HelpFAQ />
                </div>
              </div>
            </div>
          )}

          {/* Drawer Animation */}
          <style>
            {`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}
          </style>
        </>
      ) : (
        // ✅ DESKTOP VIEW (your original layout)
        <>
          {/* Left Sidebar */}
          <div
            style={{
              width: "320px",
              padding: "40px 30px",
              display: "flex",
              flexDirection: "column",
              gap: "40px",
              background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
              //borderRight: "1px solid #e5e7eb",
            }}
          >
            {/* Enhanced Logo Section */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
                padding: "20px",
                borderRadius: "16px",
                background:
                  "linear-gradient(135deg, rgba(132, 10, 22, 0.05) 0%, rgba(132, 10, 22, 0.02) 100%)",
                border: "1px solid rgba(132, 10, 22, 0.1)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "16px" }}
              >
                <img
                  src="/lekhani_logo4.png"
                  alt="Lekhani Logo"
                  style={{
                    width: "64px",
                    height: "64px",
                    objectFit: "contain",
                    filter: "drop-shadow(0 4px 8px rgba(132, 10, 22, 0.2))",
                  }}
                />
                <h1
                  style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: "36px",
                    fontWeight: "800",
                    background:
                      "linear-gradient(135deg, #840A16 0%, #C41E3A 50%, #FF5733 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    margin: 0,
                    letterSpacing: "2px",
                    lineHeight: 1,
                  }}
                >
                  LEKHANI
                </h1>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "#64748b",
                  fontWeight: "600",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "linear-gradient(45deg, #22c55e, #16a34a)",
                    boxShadow: "0 0 12px rgba(34, 197, 94, 0.5)",
                    animation: "pulse 2s infinite",
                  }}
                />
                AI-Powered Transcription
              </div>
            </div>

            {/* Enhanced Action Buttons */}
            <div style={toolbarStyles.card}>
              <div style={toolbarStyles.title}>Actions</div>
              <div style={toolbarStyles.grid}>
                <IconButton
                  onClick={recording ? stopRecording : startRecording}
                  label={recording ? "Stop Recording" : "Start Recording"}
                  icon={recording ? "⏹️" : "▶️"}
                  disabled={transcribing || !canRecord}
                />

                <label style={{ display: "contents" }}>
                  <IconButton
                    onClick={handleUploadClick}
                    label="Upload Audio"
                    icon="📁"
                    disabled={transcribing || !canUpload}
                  />
                  <input
                    type="file"
                    accept="audio/*, .wav, .mp3, .m4a"
                    ref={fileInputRef}
                    onChange={uploadFile}
                    style={{ display: "none" }}
                  />
                </label>

                <IconButton
                  onClick={saveToFile}
                  label="Save Transcript"
                  icon="💾"
                  disabled={!finalTranscript}
                />

                <IconButton onClick={clearAll} label="Clear All" icon="❌" />
              </div>

              <div style={toolbarStyles.divider} />
              <div style={{ ...toolbarStyles.title, marginTop: 8 }}>
                Navigation
              </div>

              <div
                style={{
                  background:
                    "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "12px",
                }}
              >
                <Navbar />
                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#3b82f6",
                      boxShadow: "0 0 8px rgba(59, 130, 246, 0.5)",
                    }}
                  />
                  Currently:{" "}
                  {currentTab.charAt(0).toUpperCase() + currentTab.slice(1)}
                </div>
              </div>
            </div>

            <>
              {/* FAQ Button */}
              <button
                style={{
                  padding: "16px",
                  border: "2px dashed #cbd5e1",
                  borderRadius: "12px",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#840A16";
                  e.currentTarget.style.color = "#840A16";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.color = "#64748b";
                }}
                onClick={() => setFaqOpen(true)}
              >
                💡 Help & FAQ
              </button>

              {/* Modal */}
              {faqOpen && (
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 999,
                  }}
                  onClick={() => setFaqOpen(false)} // click outside closes modal
                >
                  <div
                    onClick={(e) => e.stopPropagation()} // prevent modal from closing when clicking inside
                    style={{
                      width: "90%",
                      maxWidth: 900,
                      maxHeight: "90vh",
                      overflowY: "auto",
                      backgroundColor: "#fff",
                      borderRadius: 16,
                      padding: 20,
                      boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
                    }}
                  >
                    <button
                      onClick={() => setFaqOpen(false)}
                      style={{
                        position: "absolute",
                        top: 20,
                        right: 30,
                        fontSize: 20,
                        fontWeight: "bold",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      ❌
                    </button>
                    <HelpFAQ />
                  </div>
                </div>
              )}
            </>
          </div>

          {/* Main Content */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              position: "relative",
              background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            }}
          >
            {/* Header Spacer */}
            <WelcomeBanner />
            {/* Enhanced Candidate Info + Question dropdown */}
            <div
              style={{
                padding: "40px 60px 30px",
                display: "flex",
                gap: "20px",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minWidth: "200px",
                }}
              >
                <input
                  type="text"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "2px solid #e5e7eb",
                    fontSize: "14px",
                    fontWeight: "500",
                    background: "#ffffff",
                    transition: "all 0.2s ease",
                    outline: "none",
                    visibility: "hidden",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#840A16";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(132, 10, 22, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minWidth: "250px",
                }}
              ></div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  flex: 1,
                  minWidth: "300px",
                }}
              ></div>
            </div>

            {/* Enhanced Transcript Area */}
            <div
              style={{ flex: 1, padding: "0 62px 122px", position: "relative" }}
            >
              <div
                style={{ position: "relative", width: "100%", height: "100%" }}
              >
                <textarea
                  value={finalTranscript}
                  onChange={(e) => setFinalTranscript(e.target.value)}
                  placeholder="Your transcription will appear here... Start recording or upload an audio file to begin."
                  style={{
                    marginTop: "5px",
                    width: "93%",
                    height: "92%",
                    minHeight: "300px",
                    padding: "30px",
                    border: "2px solid #e5e7eb",
                    borderRadius: "16px",
                    fontSize: "18px",
                    lineHeight: "1.6",
                    fontFamily: "'Georgia', serif",
                    backgroundColor: "#ffffff",
                    color: "#1f2937",
                    outline: "none",
                    resize: "none",
                    boxShadow:
                      "0 4px 20px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#840A16";
                    e.currentTarget.style.boxShadow =
                      "0 8px 30px rgba(132, 10, 22, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.boxShadow =
                      "0 4px 20px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)";
                  }}
                />

                {/* Recording indicator inside textarea */}
                {/* Indicator for Recording or Uploading */}
                {(recording || uploading) && (
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "rgba(255,255,255,0.9)",
                      padding: "4px 8px",
                      borderRadius: "8px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: recording ? "red" : "blue",
                        borderRadius: "50%",
                        animation: "pulse 1s infinite",
                      }}
                    ></div>
                    <span
                      style={{
                        color: recording ? "red" : "blue",
                        fontWeight: "bold",
                        fontSize: "14px",
                      }}
                    >
                      {recording ? "Recording..." : "Processing..."}
                    </span>
                  </div>
                )}

                {/* Status Message at Bottom-Right Corner Edge */}
                {isProcessing && (
                  <div
                    style={{
                      position: "absolute",
                      right: "30px",
                      bottom: "30px",
                      fontSize: "13px",
                      color: "#374151",
                      fontFamily: "monospace",
                      fontWeight: "500",
                      textAlign: "right",
                      pointerEvents: "none",
                      zIndex: 15,
                      maxWidth: "180px",
                      wordWrap: "break-word",
                      background: "rgba(255, 255, 255, 0.95)",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    {/* Spinner */}
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        border: "3px solid #f3f3f3",
                        borderTop: "3px solid #840A16",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    {currentMessage}
                  </div>
                )}
              </div>
            </div>

            <Footer />
          </div>
        </>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        accept="audio/*, .wav, .mp3, .m4a"
        ref={fileInputRef}
        onChange={uploadFile}
        style={{ display: "none" }}
      />

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
      `}</style>

      {/* Spinner CSS */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Pulse CSS */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.6; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
