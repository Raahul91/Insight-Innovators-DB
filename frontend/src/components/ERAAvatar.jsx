import React from "react";

/**
 * ERA — an editorial-style illustrated human avatar with:
 *  • Blinking eyes (idle)
 *  • Lip-sync mouth animation when `speaking`
 *  • Listening pulse when `listening`
 */
export const ERAAvatar = ({ size = 64, speaking = false, listening = false, className = "" }) => {
  const talkAttr = speaking ? "true" : "false";
  const listenAttr = listening ? "true" : "false";

  return (
    <div
      className={`era-avatar ${className}`}
      style={{ width: size, height: size }}
      data-speaking={talkAttr}
      data-listening={listenAttr}
    >
      <svg
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        aria-label="ERA avatar"
      >
        <defs>
          <clipPath id="era-face-clip">
            <circle cx="60" cy="60" r="60" />
          </clipPath>
          <linearGradient id="era-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F6D0B4" />
            <stop offset="100%" stopColor="#EAB396" />
          </linearGradient>
          <linearGradient id="era-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#EAF2FF" />
            <stop offset="100%" stopColor="#D9E6FA" />
          </linearGradient>
          <linearGradient id="era-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A2418" />
            <stop offset="100%" stopColor="#5A3826" />
          </linearGradient>
        </defs>

        <g clipPath="url(#era-face-clip)">
          {/* Background */}
          <rect width="120" height="120" fill="url(#era-bg)" />

          {/* Shoulders / blazer */}
          <path d="M 6 120 Q 60 88 114 120 Z" fill="#0A2540" />
          {/* Collar / shirt V */}
          <path d="M 44 118 L 60 100 L 76 118 Z" fill="#FFFFFF" />
          <path d="M 60 100 L 60 118" stroke="#0A2540" strokeWidth="1.2" />

          {/* Neck */}
          <rect x="52" y="86" width="16" height="14" fill="url(#era-skin)" />
          <path d="M 52 92 Q 60 96 68 92" fill="#D69B7C" opacity="0.5" />

          {/* Face oval */}
          <ellipse cx="60" cy="58" rx="30" ry="34" fill="url(#era-skin)" />

          {/* Hair — front sweep */}
          <path
            d="M 30 58 Q 28 24 60 22 Q 92 24 90 58 Q 87 44 82 42 Q 78 30 60 30 Q 42 30 38 42 Q 33 44 30 58 Z"
            fill="url(#era-hair)"
          />
          {/* Side lock */}
          <path d="M 30 58 Q 26 70 30 82 Q 36 68 34 58 Z" fill="url(#era-hair)" />

          {/* Cheek blush */}
          <ellipse cx="42" cy="72" rx="5" ry="3.5" fill="#F5A88F" opacity="0.45" />
          <ellipse cx="78" cy="72" rx="5" ry="3.5" fill="#F5A88F" opacity="0.45" />

          {/* Eyebrows */}
          <path
            d="M 44 54 Q 50 51 56 54"
            stroke="#3A2418"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 64 54 Q 70 51 76 54"
            stroke="#3A2418"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Eyes (blinking group) */}
          <g className="era-eyes">
            <ellipse cx="50" cy="62" rx="2.8" ry="3.6" fill="#1F1B1B" />
            <ellipse cx="70" cy="62" rx="2.8" ry="3.6" fill="#1F1B1B" />
            <circle cx="50.9" cy="60.6" r="0.9" fill="#FFFFFF" />
            <circle cx="70.9" cy="60.6" r="0.9" fill="#FFFFFF" />
          </g>

          {/* Nose */}
          <path
            d="M 60 66 Q 57 74 60 77 Q 63 74 60 66"
            stroke="#C08972"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Mouth group — closed line + open oval swap via CSS */}
          <g className="era-mouth">
            <path
              className="era-mouth-line"
              d="M 54 83 Q 60 86 66 83"
              stroke="#8B3A2E"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
            <ellipse className="era-mouth-oval" cx="60" cy="83" rx="4.2" ry="1" fill="#8B3A2E" />
            <ellipse className="era-mouth-teeth" cx="60" cy="82.2" rx="3.4" ry="0.6" fill="#FFFFFF" />
          </g>
        </g>

        {/* Listening ring */}
        <circle
          className="era-listen-ring"
          cx="60"
          cy="60"
          r="58"
          fill="none"
          stroke="#FF3B30"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
      </svg>
    </div>
  );
};
