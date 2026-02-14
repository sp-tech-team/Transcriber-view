// ProgressBar.js
import React, { useEffect, useState } from "react";

export default function ProgressBar() {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const eventSource = new EventSource(
      `${process.env.REACT_APP_BACKEND_URL}/status-stream`
    );

    eventSource.onmessage = (event) => {
      const status = event.data;
      const match = status.match(/^(\d+)%\s*(.*)$/); // Extract percentage + message
      if (match) {
        setProgress(parseInt(match[1], 10));
        setMessage(match[2]);
      } else {
        setMessage(status);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  if (progress === 0 && !message) return null; // hide until something starts

  return (
    <div
      style={{
        width: "100%",
        padding: "10px",
        background: "#f5f5f5",
        borderRadius: "8px",
        marginBottom: "10px",
      }}
    >
      <div style={{ marginBottom: "5px" }}>{message}</div>
      <div style={{ width: "100%", background: "#ddd", borderRadius: "8px" }}>
        <div
          style={{
            width: `${progress}%`,
            background: "#4caf50",
            height: "10px",
            borderRadius: "8px",
            transition: "width 0.3s ease",
          }}
        ></div>
      </div>
    </div>
  );
}
