import React from "react";
import eraIdle from "../assets/era-human-v2.png";
import eraSpeaking from "../assets/era-human-speaking-v2.png";

/**
 * ERA — a human advisor with a permanently stable face layer and two matched
 * lower-body gesture layers. Only the shoulders, arms, and hands transition
 * while speaking, preventing identity flicker.
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
      <div className="era-listening-waves" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="era-character-figure">
        <img
          src={eraIdle}
          alt="ERA"
          draggable={false}
          className="era-character-img era-character-img-face"
        />
        <img
          src={eraIdle}
          alt=""
          aria-hidden
          draggable={false}
          className="era-character-img era-character-img-gesture era-character-img-gesture-idle"
        />
        <img
          src={eraSpeaking}
          alt=""
          aria-hidden
          draggable={false}
          className="era-character-img era-character-img-gesture era-character-img-gesture-speaking"
        />
      </div>
    </div>
  );
};
