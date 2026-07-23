import React from "react";

const ERA_IMG =
  "https://customer-assets-lqy194kg.emergentagent.net/job_portfolio-builder-1659/artifacts/zb7zf1mo_agent-3d-icon-png-download-11770982.webp";

/**
 * A single stylised 3D-ish hand (sleeve + palm) rendered as SVG so it can be
 * animated with CSS transforms. Used for the left/right gesturing hands.
 */
const Hand = ({ side = "left" }) => (
  <svg
    className={`era-hand era-hand-${side}`}
    viewBox="0 0 80 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <defs>
      <linearGradient id={`sleeve-${side}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4E9BF5" />
        <stop offset="100%" stopColor="#2E7FDB" />
      </linearGradient>
      <linearGradient id={`skin-${side}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F6C6A8" />
        <stop offset="100%" stopColor="#E7A784" />
      </linearGradient>
    </defs>
    <path
      d="M 12 8 Q 6 30 14 62 Q 22 80 40 82 Q 58 80 66 62 Q 74 30 68 8 Z"
      fill={`url(#sleeve-${side})`}
    />
    <ellipse cx="40" cy="60" rx="26" ry="6" fill="#1E5FAE" opacity="0.35" />
    <ellipse cx="40" cy="72" rx="22" ry="18" fill={`url(#skin-${side})`} />
    <ellipse
      cx={side === "left" ? 20 : 60}
      cy="66"
      rx="7"
      ry="10"
      fill={`url(#skin-${side})`}
      transform={`rotate(${side === "left" ? -25 : 25} ${side === "left" ? 20 : 60} 66)`}
    />
    <path d="M 26 74 Q 40 78 54 74" stroke="#C88870" strokeWidth="1.2" fill="none" opacity="0.6" strokeLinecap="round" />
    <ellipse cx="40" cy="68" rx="12" ry="4" fill="#FFFFFF" opacity="0.35" />
  </svg>
);

/**
 * ERA — full 3D character with animated gesturing hands.
 */
export const ERAAvatar = ({ size = 440, speaking = false, listening = false, className = "" }) => {
  return (
    <div
      className={`era-character ${className}`}
      style={{ width: size, height: size }}
      data-speaking={speaking ? "true" : "false"}
      data-listening={listening ? "true" : "false"}
      aria-label="ERA — European Relationship Assistant"
    >
      <div className="era-halo" aria-hidden />
      <svg className="era-listen-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="50" cy="50" r="46" fill="none" stroke="#FF3B30" strokeWidth="1.4" strokeDasharray="3 5" />
      </svg>
      <img src={ERA_IMG} alt="ERA" draggable={false} className="era-character-img" />
      <Hand side="left" />
      <Hand side="right" />
    </div>
  );
};
