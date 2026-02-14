import React, { useEffect, useRef, useState } from "react";

export default function RecordingIndicator({ stream }) {
  const [levels, setLevels] = useState([4, 8, 12, 8, 4]); // initial bar heights
  const animationRef = useRef(null);

  useEffect(() => {
    if (!stream) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const height = Math.min(24, Math.max(4, avg / 10));

      // update bars with slight variation
      setLevels([
        height,
        height * 0.6,
        height * 1.2,
        height * 0.8,
        height * 0.5,
      ]);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      audioCtx.close();
    };
  }, [stream]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "16px",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", gap: "4px", height: "24px" }}>
        {levels.map((h, i) => (
          <div
            key={i}
            style={{
              width: "4px",
              height: `${h}px`,
              background: "#dc2626",
              borderRadius: "4px",
              transition: "height 0.1s ease",
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#dc2626",
        }}
      >
        🎤 Listening...
      </span>
    </div>
  );
}
