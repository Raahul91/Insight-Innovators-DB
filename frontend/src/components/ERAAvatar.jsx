import React from "react";
import eraIdle from "../assets/era-human-v2.png";
import { useEraVoice } from "./EraVoiceContext";

/**
 * Era uses one stable source portrait. OpenAI speech energy drives a small
 * masked jaw region and natural whole-body micro-motion without swapping faces.
 */
export const ERAAvatar = ({ size = 440, speaking = false, listening = false, className = "" }) => {
  const { audioLevel, preparing } = useEraVoice();
  const reactiveLevel = speaking ? Math.max(0.08, audioLevel) : 0;

  return (
    <div
      className={`era-character ${className}`}
      style={{
        width: size,
        height: size,
        "--era-audio-level": reactiveLevel.toFixed(3),
      }}
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
          className="era-character-img era-character-img-base"
        />
        <img
          src={eraIdle}
          alt=""
          aria-hidden
          draggable={false}
          className="era-character-img era-character-img-mouth"
        />
      </div>
      {preparing && (
        <span className="era-voice-preparing" aria-label="Preparing Era's voice">
          Preparing voice…
        </span>
      )}
    </div>
  );
};
