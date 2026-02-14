import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
} from "react";
import { backendURL } from "./config";
import { useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import Toast from "./component/Toast";
import Navbar from "./NavBar";
import IconButton from "./component/IconButton";
import Footer from "./component/Footer";
import { useLocation } from "react-router-dom";
import HelpFAQ from "./component/HelpFAQ";
import useUnsavedChangesGuard from "./Hook/useUnsavedChangesGuard";
import { AuthContext } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import WelcomeBanner from "./component/WelcomeBanner";
import { supabase } from "./supabase/supabaseClient";
import PermissionBanner from "./component/PermissionBanner";

export default function QuestionRecorder() {
  const { category } = useParams();
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [availableFiles, setAvailableFiles] = useState([]);
  const [candidateID, setCandidateID] = useState("");
  const [name, setName] = useState("");
  const [statusLog, setStatusLog] = useState(["System ready"]);
  const [recording, setRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [categories, setCategories] = useState([]);
  const [toastMessage, setToastMessage] = useState("");
  const [fileHandle, setFileHandle] = useState(null);
  const [currentMessage, setCurrentMessage] = useState("");
  const location = useLocation();
  const [candidateId, setCandidateId] = useState("");
  const [inputsDisabled, setInputsDisabled] = useState(false);

  const { user, profile, accessToken } = useContext(AuthContext); // ✅ Get all three

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login"); // 🚨 redirect if not logged in
    }
  }, [user, navigate]);

  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentTab = pathParts[pathParts.length - 1] || "Question Recorder";

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  const [faqOpen, setFaqOpen] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  const isDirty =
    finalTranscript.trim() !== "" ||
    candidateID.trim() !== "" ||
    name.trim() !== "";

  // 🔒 Activate guard
  useUnsavedChangesGuard(isDirty);

  //Mobile display
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
    fetch(`${backendURL}/categories`)
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  const loadQuestionsFromBackend = useCallback(() => {
    if (!category) return;

    fetch(`${backendURL}/load-questions/${category}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Server error: ${res.status} - ${err}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.questions) setQuestions(data.questions);
      })
      .catch((err) => {
        console.error("Failed to load questions:", err);
        setStatusLog((prev) => [
          ...prev,
          `Error loading questions: ${err.message}`,
        ]);
      });
  }, [category]);

  useEffect(() => {
    loadQuestionsFromBackend();
  }, [loadQuestionsFromBackend]);

  const filteredQuestions = questions.filter(
    (q) => !answeredQuestions.includes(q)
  );

  const startRecording = async () => {
    if (!candidateID || !name || !selectedQuestion) {
      setStatusLog((prev) => [
        ...prev,
        "⚠️ Please fill candidate info & select question",
      ]);
      return;
    }
    setStatusLog((prev) => [...prev, "Recording started..."]);
    setIsProcessing(true);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunks.current = [];
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.current.push(event.data);
    };
    mediaRecorderRef.current.start();
    setRecording(true);
  };

  const stopRecording = () => {
    setStatusLog((prev) => [...prev, "Recording stopped"]);
    mediaRecorderRef.current.onstop = handleRecordingStop;
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const handleRecordingStop = async () => {
    const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
    await sendToBackend(audioBlob);
  };

  const sendToBackend = async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");
    try {
      const res = await fetch(`${backendURL}/transcribe`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setFinalTranscript(data.text || "");
    } catch {
      setStatusLog((prev) => [...prev, "Error during transcription"]);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!category) return;

    fetch(`${backendURL}/categories`)
      .then((res) => res.json())
      .then((cats) => {
        const selectedCategory = cats.find((cat) => cat.key === category);
        if (selectedCategory?.requiresFileUpload) {
          fetch(`${backendURL}/list-question-files/${category}`)
            .then((res) => res.json())
            .then((data) => setAvailableFiles(data.files || []));
        }
      })
      .catch((err) => console.error("Error fetching categories:", err));
  }, [category]);

  useEffect(() => {
    if (category && selectedFile) {
      fetch(`${backendURL}/load-questions/${category}/${selectedFile}`)
        .then((res) => res.json())
        .then((data) => {
          setQuestions(data.questions || []);
          setAnsweredQuestions([]);
        });
    }
  }, [category, selectedFile]);

  // ✅ Google Sheets save function
  const saveAnswerToGoogleSheet = async (
    newAnswerRow,
    selectedQuestion,
    setFeedbackStatus,
    setAnsweredQuestions,
    setSelectedQuestion,
    setFinalTranscript,
    accessToken
  ) => {
    try {
      let sheetId = profile?.sheet_id || null;

      const questionText = newAnswerRow[3];
      const answerText = newAnswerRow[4];

      if (!questionText?.trim() || !answerText?.trim()) {
        setFeedbackStatus("⚠️ Cannot save without a Question and Answer.");
        setTimeout(() => setFeedbackStatus(""), 3000);
        return;
      }

      const getISTTimestamp = () =>
        new Date().toLocaleString("en-GB", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour24: true,
        });

      newAnswerRow[5] = getISTTimestamp();

      const res = await fetch(`${backendURL}/save-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet_id: sheetId,
          row: newAnswerRow,
          access_token: accessToken,
        }),
      });

      console.log("Response status:", res.status);

      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch (e) {
          errorData = { error: `HTTP ${res.status} error` };
        }

        console.log("Error data:", errorData);

        // ✅ Backend detected scope issue - force re-authentication
        if (
          errorData.reauthenticate ||
          errorData.error_code === "SCOPE_INSUFFICIENT"
        ) {
          const shouldReauth = window.confirm(
            `${errorData.error}\n\nWould you like to sign out and re-authenticate now?`
          );

          if (shouldReauth) {
            await supabase.auth.signOut();
          }
          return;
        }

        // Handle other errors
        if (res.status === 403) {
          setFeedbackStatus(`🚫 ${errorData.error}`);
          setTimeout(() => setFeedbackStatus(""), 8000);
          return;
        }

        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        if (!sheetId && data.sheet_id) {
          await supabase
            .from("profiles")
            .update({ sheet_id: data.sheet_id })
            .eq("id", user.id);
        }

        setFeedbackStatus("✅ Answer saved to Google Sheet.");
        setTimeout(() => setFeedbackStatus(""), 3000);

        setAnsweredQuestions((prev) => [...prev, selectedQuestion]);
        setSelectedQuestion("");
        setFinalTranscript("");
      }
    } catch (err) {
      console.error("Error saving to Google Sheet:", err);
      setFeedbackStatus("❌ Error: " + err.message);
      setTimeout(() => setFeedbackStatus(""), 5000);
    }
  };
  // ❌ Remove pickExcelFile and fileHandle since Google Sheets replaces local Excel

  // ✅ Submit Answer handler
  const submitAnswer = async () => {
    // ✅ Check if accessToken is available
    if (!accessToken) {
      setFeedbackStatus("⚠️ Not authenticated. Please log in again.");
      setTimeout(() => setFeedbackStatus(""), 3000);
      return;
    }

    // Validation for ID + Name
    if (!candidateID?.trim() || !name?.trim()) {
      setFeedbackStatus("⚠️ Cannot save without a Id and Name.");
      setTimeout(() => setFeedbackStatus(""), 3000);
      return;
    }

    if (!finalTranscript?.trim()) {
      setFeedbackStatus("⚠️ Cannot save blank answer.");
      setTimeout(() => setFeedbackStatus(""), 3000);
      return;
    }

    if (!selectedQuestion?.trim()) {
      setFeedbackStatus("⚠️ Cannot save without question.");
      setTimeout(() => setFeedbackStatus(""), 3000);
      return;
    }

    // Build row
    const newRow = [
      name,
      candidateID,
      category,
      selectedQuestion,
      finalTranscript,
      "", // timestamp will be added inside saveAnswerToGoogleSheet
    ];

    // ✅ Pass accessToken from state
    await saveAnswerToGoogleSheet(
      newRow,
      selectedQuestion,
      setFeedbackStatus,
      setAnsweredQuestions,
      setSelectedQuestion,
      setFinalTranscript,
      accessToken // ✅ Now it's defined!
    );
  };

  const handleClick = () => {
    submitAnswer();
  };

  const clearAll = () => {
    setFinalTranscript("");
    setStatusLog(["System ready"]);
    setFeedbackStatus("");
  };

  const nextPerson = () => {
    setCandidateID("");
    setName("");
    setSelectedQuestion("");
    setAnsweredQuestions([]);
    loadQuestionsFromBackend();
    clearAll();
    setInputsDisabled(false); // 🔓 re-enable inputs
  };

  const reloadFromFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${backendURL}/load-questions-file/${category}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions);
        setAnsweredQuestions([]);
      } else {
        console.error("Error loading questions:", data.error);
      }
    } catch (err) {
      console.error("Error:", err);
    }
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
              label={recording ? "Stop Recording" : "Start Recording"}
              icon={recording ? "⏹️" : "▶️"}
            />
            <IconButton
              onClick={handleClick}
              label={fileHandle ? "Save File" : "Upload File"}
              icon={fileHandle ? "💾" : "📂"}
              disabled={recording || !finalTranscript}
            />
            <IconButton onClick={nextPerson} label="Next Person" icon="👤" />
            <IconButton onClick={clearAll} label="Clear Transcript" icon="❌" />
          </div>

          {/* Question Dropdown */}
          <div style={{ padding: "0 16px 12px" }}>
            {/* Candidate Info */}
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
                placeholder="Enter Candidate ID"
                value={candidateID}
                onChange={(e) => setCandidateID(e.target.value)}
                disabled={inputsDisabled}
                style={{
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />

              <input
                type="text"
                placeholder="Enter Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={inputsDisabled}
                style={{
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />

              <select
                value={selectedQuestion}
                onChange={(e) => setSelectedQuestion(e.target.value)}
                disabled={filteredQuestions.length === 0} // ✅ only disable when no questions remain
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "16px",
                  backgroundColor: "#fff",
                  cursor: inputsDisabled ? "not-allowed" : "pointer",
                }}
              >
                {/* ✅ Show placeholder only if nothing selected */}
                {!selectedQuestion && (
                  <option value="">
                    {filteredQuestions.length === 0
                      ? "No questions available"
                      : "-- Select a question --"}
                  </option>
                )}

                {/* ✅ Actual question list */}
                {filteredQuestions.map((q, index) => (
                  <option key={index} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
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

            {isProcessing && !recording && (
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
              placeholder="Start recording to capture the candidate's response..."
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
                Question Recorder
              </div>
            </div>

            {/* Enhanced Action Buttons */}
            <div
              style={{
                padding: "20px",
                borderRadius: 16,
                background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                border: "1px solid #e5e7eb",
                boxShadow:
                  "0 4px 15px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#840A16",
                  letterSpacing: "0.8px",
                  margin: "0 0 16px",
                  textTransform: "uppercase",
                }}
              >
                Actions
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <IconButton
                  onClick={recording ? stopRecording : startRecording}
                  label={recording ? "Stop Recording" : "Start Recording"}
                  icon={recording ? "⏹️" : "▶️"}
                />
                <IconButton
                  onClick={handleClick}
                  label={"Save"}
                  icon={"💾"}
                  //label={fileHandle ? "Save" : "Upload Excel file"}
                  //icon={fileHandle ? "💾" : "📂"}
                  disabled={recording || !finalTranscript} // 🚫 disable while recording OR no transcript
                />

                <IconButton
                  onClick={nextPerson}
                  label="Next Person"
                  icon="👤"
                />
                <IconButton onClick={clearAll} label="Clear" icon="❌" />
              </div>

              <div
                style={{
                  height: 1,
                  background:
                    "linear-gradient(90deg, transparent, #e5e7eb, transparent)",
                  margin: "16px 0 12px",
                }}
              />

              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#840A16",
                  letterSpacing: "0.8px",
                  margin: "8px 0 16px",
                  textTransform: "uppercase",
                }}
              >
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

            {/* FAQ Button */}
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

          {/* Main Panel */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            }}
          >
            <WelcomeBanner />
            {/* Enhanced Candidate Info + Question dropdown */}
            <div
              style={{
                padding: "35px 60px 30px",
                //background: "linear-gradient(180deg, black 0%, #fafafa 100%)",
                //borderBottom: "1px solid #e5e7eb",
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
                  placeholder="Enter Candidate ID"
                  value={candidateID}
                  onChange={(e) => setCandidateID(e.target.value)}
                  disabled={inputsDisabled}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "2px solid #e5e7eb",
                    fontSize: "14px",
                    fontWeight: "500",
                    background: "#ffffff",
                    transition: "all 0.2s ease",
                    outline: "none",
                    backgroundColor: inputsDisabled ? "#f3f4f6" : "#fff", // light gray if disabled
                    color: inputsDisabled ? "#9ca3af" : "#000", // dimmed text if disabled
                    cursor: inputsDisabled ? "not-allowed" : "text", // 🚫 cursor if disabled
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
              >
                <input
                  type="text"
                  placeholder="Enter Candidate full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={inputsDisabled}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "2px solid #e5e7eb",
                    fontSize: "14px",
                    fontWeight: "500",
                    background: "#ffffff",
                    transition: "all 0.2s ease",
                    outline: "none",
                    backgroundColor: inputsDisabled ? "#f3f4f6" : "#fff", // light gray if disabled
                    color: inputsDisabled ? "#9ca3af" : "#000", // dimmed text if disabled
                    cursor: inputsDisabled ? "not-allowed" : "text", // 🚫 cursor if disabled
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
                  flex: 1,
                  minWidth: "300px",
                }}
              >
                <select
                  value={selectedQuestion}
                  onChange={(e) => setSelectedQuestion(e.target.value)}
                  size={1}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "2px solid #e5e7eb",
                    fontSize: "14px",
                    textAlign: "center",
                    background: "#ffffff",
                    maxHeight: "120px",
                    overflowY: "auto",
                    outline: "none",
                    transition: "all 0.2s ease",
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
                >
                  {/* Show placeholder only if no question selected */}
                  {!selectedQuestion && (
                    <option value="">
                      {filteredQuestions.length === 0
                        ? "No questions available"
                        : "-- Select a question --"}
                    </option>
                  )}

                  {/* Questions */}
                  {filteredQuestions.map((q, i) => (
                    <option
                      key={i}
                      value={q}
                      title={q} // Tooltip for full text
                    >
                      {q.length > 50 ? q.slice(0, 50) + "..." : q}
                    </option>
                  ))}
                </select>
              </div>

              {categories.find((cat) => cat.key === category)
                ?.requiresFileUpload && (
                <label
                  style={{
                    cursor: "pointer",
                    background: "linear-gradient(135deg, #f3f4f6, #e5e7eb)",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#374151",
                    border: "2px solid #e5e7eb",
                    transition: "all 0.2s ease",
                    alignSelf: "flex-end",
                  }}
                >
                  📄 Reload Questions
                  <input
                    type="file"
                    accept=".xlsx"
                    hidden
                    onChange={reloadFromFile}
                  />
                </label>
              )}
            </div>

            {/* Enhanced Transcript + Logs */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "10px 60px 120px",
                  position: "relative",
                }}
              >
                <PermissionBanner />

                <textarea
                  value={finalTranscript}
                  onChange={(e) => setFinalTranscript(e.target.value)}
                  placeholder="Start recording to capture the candidate's response..."
                  style={{
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
                {recording && (
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "85px",
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
                        backgroundColor: "red",
                        borderRadius: "50%",
                        animation: "pulse 1s infinite",
                      }}
                    ></div>
                    <span
                      style={{
                        color: "red",
                        fontWeight: "bold",
                        fontSize: "14px",
                      }}
                    >
                      Recording...
                    </span>
                  </div>
                )}

                {/* Auto-clearing Status Message */}
                {currentMessage && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)", // centers it perfectly
                      fontSize: "12px",
                      color: "red",
                      fontFamily: "monospace",
                      textAlign: "center",
                      pointerEvents: "none",
                      zIndex: 10,
                      maxWidth: "300px",
                      wordWrap: "break-word",
                    }}
                  >
                    {currentMessage}
                  </div>
                )}
              </div>
            </div>

            <Footer />
          </div>
        </>
      )}

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage("")} />
      )}

      {/* Save Status */}
      {feedbackStatus && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "60%",
            transform: "translate(-50%, -50%)",
            padding: "12px 20px",
            background: feedbackStatus.startsWith("⚠️")
              ? "linear-gradient(135deg, #dc2626, #b91c1c)" // 🔴 red gradient for warnings
              : "linear-gradient(135deg, #22c55e, #16a34a)", // ✅ green for success
            color: "#ffffff",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "600",
            boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          {feedbackStatus}
        </div>
      )}

      {!isMobile && isProcessing && (
        <div
          style={{
            position: "absolute",
            right: "120px",
            bottom: "60px",
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
