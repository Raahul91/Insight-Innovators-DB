import React from "react";

const ERA_IMG =
  "https://customer-assets-lqy194kg.emergentagent.net/job_portfolio-builder-1659/artifacts/zb7zf1mo_agent-3d-icon-png-download-11770982.webp";

/**
 * ERA — full 3D character (freestanding, no circular chatbot wrapper).
 * Preserves animations for `speaking` (halo + head bob) and `listening` (dashed ring behind).
 */
export const ERAAvatar = ({ size = 320, speaking = false, listening = false, className = "" }) => {
  return (
    <div
      className={`era-character ${className}`}
      style={{ width: size, height: size }}
      data-speaking={speaking ? "true" : "false"}
      data-listening={listening ? "true" : "false"}
      aria-label="ERA — European Relationship Assistant"
    >
      <div className="era-halo" aria-hidden />
      <svg
        className="era-listen-svg"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="#FF3B30"
          strokeWidth="1.4"
          strokeDasharray="3 5"
        />
      </svg>
      <img
        src={ERA_IMG}
        alt="ERA"
        draggable={false}
        className="era-character-img"
      />
    </div>
  );
};
