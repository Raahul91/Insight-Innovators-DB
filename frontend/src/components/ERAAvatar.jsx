import React from "react";

const ERA_IMG =
  "https://customer-assets-lqy194kg.emergentagent.net/job_portfolio-builder-1659/artifacts/zb7zf1mo_agent-3d-icon-png-download-11770982.webp";

/**
 * ERA — full 3D-style human avatar (call-centre style).
 * Uses the provided character illustration.
 * Adds subtle animations for `speaking` (bob + halo) and `listening` (rotating ring).
 */
export const ERAAvatar = ({ size = 64, speaking = false, listening = false, className = "" }) => {
  return (
    <div
      className={`era-avatar-3d ${className}`}
      style={{ width: size, height: size }}
      data-speaking={speaking ? "true" : "false"}
      data-listening={listening ? "true" : "false"}
      aria-label="ERA avatar"
    >
      <div className="era-halo" aria-hidden />
      <img
        src={ERA_IMG}
        alt="ERA — European Relationship Assistant"
        draggable={false}
        className="era-avatar-img"
      />
      <svg
        className="era-listen-svg"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          stroke="#FF3B30"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
      </svg>
    </div>
  );
};
