import React from "react";

/**
 * ERA — realistic human presenter portrait with layered animations.
 * The base image is a real professional photograph; hands and body gestures
 * are inherent to the photo. CSS keyframes animate breathing (idle), speaking
 * body-motion + head-bob (when `speaking`), and a listening ring.
 */
const ERA_IMG =
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80";

export const ERAAvatar = ({ size = 440, speaking = false, listening = false, className = "" }) => {
  return (
    <div
      className={`era-human ${className}`}
      style={{ width: size, height: size * 1.15 }}
      data-speaking={speaking ? "true" : "false"}
      data-listening={listening ? "true" : "false"}
      aria-label="ERA — European Relationship Assistant"
    >
      <div className="era-human-shadow" aria-hidden />
      <div className="era-human-halo" aria-hidden />
      <svg className="era-listen-svg" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="46" fill="none" stroke="#FF3B30" strokeWidth="1.4" strokeDasharray="3 5" />
      </svg>
      <div className="era-human-frame">
        <img
          src={ERA_IMG}
          alt="ERA presenter"
          draggable={false}
          className="era-human-img"
        />
        <div className="era-human-vignette" aria-hidden />
      </div>
    </div>
  );
};
