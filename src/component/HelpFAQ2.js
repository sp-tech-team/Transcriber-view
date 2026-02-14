import React, { useState } from "react";

const faqData = [
  {
    question: "Getting Started",
    answer: (
      <>
        <p>Welcome to Lekhani! Follow these steps to start:</p>
        <ul>
          <li>Open the site in your browser.</li>
        </ul>
      </>
    ),
  },
  {
    question: "Uploading Audio",
    answer: (
      <ul>
        <li>Upload any audio wish to transcribe.</li>
        <li>
          Click <strong>Upload Audio (📂)</strong> to select a `.mp3/.wav ...`
          file.
        </li>
      </ul>
    ),
  },
  {
    question: "Recording Audio",
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
    question: "Download Transcription",
    answer: (
      <ul>
        <li>
          Click <strong>Save (💾)</strong> to download to default download
          folder.
        </li>
        <li>
          A pop up will appear with Save as: then give any name you'd like
        </li>

        <li>Will automatically get downloaded: ✅ </li>
      </ul>
    ),
  },
  {
    question: "Navigation & Controls",
    answer: (
      <ul>
        <li>▶️ / ⏹️: Start/Stop Recording</li>
        <li>📂 : Upload audio</li>
        <li>💾 : Save or Download file</li>
        <li>❌ Clear: Reset transcript and status logs</li>
      </ul>
    ),
  },
  {
    question: "Troubleshooting",
    answer: (
      <ul>
        <li>Microphone not detected: Check permissions and connection.</li>
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
