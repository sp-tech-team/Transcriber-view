import React, { useState } from "react";

const faqData = [
  {
    question: "Getting Started",
    answer: (
      <>
        <p>Welcome to Lekhani! Follow these steps to start:</p>
        <ul>
          <li>Open the site in your browser.</li>
          <li>Log in using your credentials (if required).</li>
          <li>
            Navigate to the <strong>Question Recorder</strong> tab.
          </li>
          <li>Enter Candidate ID and Full Name before recording.</li>
        </ul>
      </>
    ),
  },
  {
    question: "Uploading & Managing Questions",
    answer: (
      <ul>
        <li>Default questions are preloaded from the server.</li>
        <li>Only unanswered questions appear in the dropdown.</li>
        <li>
          Click <strong>Upload Excel File (📂)</strong> to select a `.xlsx`
          file.
        </li>
        <li>
          Use <strong>Reload Questions (📄)</strong> to load questions from
          uploaded files.
        </li>
      </ul>
    ),
  },
  {
    question: "Recording Answers",
    answer: (
      <ul>
        <li>
          Click <strong>Start Recording (▶️)</strong> to capture audio.
        </li>
        <li>
          Click <strong>Stop Recording (⏹️)</strong> to finish.
        </li>
        <li>
          While processing, a <strong>“⏳ Processing…”</strong> message appears
          until transcription is ready.
        </li>
        <li>Edit transcript in the text box if needed before saving.</li>
      </ul>
    ),
  },
  {
    question: "Saving Answers",
    answer: (
      <ul>
        <li>
          Click <strong>Save (💾)</strong> to store answers in an Excel file.
        </li>
        <li>
          All fields must be filled: Candidate ID, Name, selected question, and
          answer.
        </li>
        <li>
          If validation fails, warnings appear:
          <ul>
            <li>⚠️ Cannot save without a Id and Name.</li>
            <li>⚠️ Cannot save without a Question and Answer.</li>
          </ul>
        </li>
        <li>Success message: ✅ Answer saved to file.</li>
        <li>Saved questions are removed from the dropdown.</li>
      </ul>
    ),
  },
  {
    question: "Navigation & Controls",
    answer: (
      <ul>
        <li>▶️ / ⏹️: Start/Stop Recording</li>
        <li>💾 / 📂: Save or Upload Excel File</li>
        <li>👤 Next Person: Reset form and enable editing</li>
        <li>❌ Clear: Reset transcript and status logs</li>
        <li>📄 Reload Questions: Load from uploaded Excel file</li>
      </ul>
    ),
  },
  {
    question: "Troubleshooting",
    answer: (
      <ul>
        <li>Microphone not detected: Check permissions and connection.</li>
        <li>
          Save button not working: Ensure all required fields are filled and
          file is uploaded.
        </li>
        <li>Processing stuck: Backend may be slow. Refresh and try again.</li>
      </ul>
    ),
  },
  {
    question: "Tips for Best Use",
    answer: (
      <ul>
        <li>Use a quiet environment for accurate transcription.</li>
        <li>Avoid leaving the page during recording.</li>
        <li>Regularly save answers to prevent data loss.</li>
        <li>Name Excel files clearly for easy tracking.</li>
      </ul>
    ),
  },
];

export default function HelpFAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "20px 30px",
        background: "#ffffff",
        borderRadius: 16,
        boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <h1
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: 32,
          fontWeight: 800,
          background:
            "linear-gradient(135deg, #840A16 0%, #C41E3A 50%, #FF5733 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 20,
          letterSpacing: 1,
        }}
      >
        Help & FAQ
      </h1>

      {faqData.map((item, index) => (
        <div key={index} style={{ marginBottom: 16 }}>
          <div
            onClick={() => toggleFAQ(index)}
            style={{
              background: "#f3f4f6",
              padding: "12px 16px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {item.question}
            <span>{openIndex === index ? "▲" : "▼"}</span>
          </div>
          {openIndex === index && (
            <div
              style={{
                padding: "12px 16px",
                background: "#f9fafb",
                borderLeft: "4px solid #840A16",
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
