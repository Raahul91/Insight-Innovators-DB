import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API } from "../lib/api";

const PCM_SAMPLE_RATE = 24_000;
const EraVoiceContext = createContext(null);

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "Era voice request failed.");
  }
  return payload;
};

const decodeBase64Pcm = (encodedAudio, audioContext) => {
  const binary = window.atob(encodedAudio);
  const sampleCount = Math.floor(binary.length / 2);
  const audioBuffer = audioContext.createBuffer(1, sampleCount, PCM_SAMPLE_RATE);
  const channel = audioBuffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index += 1) {
    const low = binary.charCodeAt(index * 2);
    const high = binary.charCodeAt(index * 2 + 1);
    let sample = (high << 8) | low;
    if (sample >= 0x8000) sample -= 0x10000;
    channel[index] = sample / 0x8000;
  }
  return audioBuffer;
};

export const EraVoiceProvider = ({ children }) => {
  const [configured, setConfigured] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const completionRef = useRef(null);
  const animationFrameRef = useRef(null);
  const generationRef = useRef(0);
  const configurationPromiseRef = useRef(null);

  const loadConfiguration = useCallback(async () => {
    if (!configurationPromiseRef.current) {
      configurationPromiseRef.current = requestJson("/era/voice/status")
        .then((status) => {
          const enabled = Boolean(status.configured);
          setConfigured(enabled);
          return enabled;
        })
        .catch(() => {
          setConfigured(false);
          return false;
        });
    }
    return configurationPromiseRef.current;
  }, []);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("WEB_AUDIO_NOT_SUPPORTED");
      audioContextRef.current = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try {
        sourceRef.current.stop();
      } catch (_) {
        // The source may already have completed.
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    completionRef.current?.();
    completionRef.current = null;
    setAudioLevel(0);
    setPlaying(false);
    setPreparing(false);
  }, []);

  const playText = useCallback(
    async (text, { onStart } = {}) => {
      stop();
      const generation = generationRef.current;
      const isConfigured = await loadConfiguration();
      if (!isConfigured) throw new Error("OPENAI_VOICE_NOT_CONFIGURED");
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
        throw new Error("ERA_VOICE_REQUIRES_INTERACTION");
      }

      setPreparing(true);
      let audioContext;
      let speech;
      try {
        [audioContext, speech] = await Promise.all([
          ensureAudioContext(),
          requestJson("/era/voice/speech", {
            method: "POST",
            body: JSON.stringify({ text }),
          }),
        ]);
      } catch (error) {
        setPreparing(false);
        throw error;
      }
      if (generation !== generationRef.current) {
        setPreparing(false);
        throw new Error("ERA_SPEECH_CANCELLED");
      }

      const source = audioContext.createBufferSource();
      const analyser = audioContext.createAnalyser();
      const gain = audioContext.createGain();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.buffer = decodeBase64Pcm(speech.audio, audioContext);
      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(audioContext.destination);
      sourceRef.current = source;

      const waveform = new Uint8Array(analyser.fftSize);
      let smoothedLevel = 0;
      const updateLevel = () => {
        analyser.getByteTimeDomainData(waveform);
        let energy = 0;
        for (let index = 0; index < waveform.length; index += 1) {
          const normalized = (waveform[index] - 128) / 128;
          energy += normalized * normalized;
        }
        const rms = Math.sqrt(energy / waveform.length);
        const target = Math.max(0, Math.min(1, (rms - 0.018) * 5.5));
        smoothedLevel = smoothedLevel * 0.68 + target * 0.32;
        setAudioLevel(smoothedLevel);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      setPreparing(false);
      setPlaying(true);
      source.start();
      onStart?.();
      updateLevel();

      const completedNaturally = await new Promise((resolve) => {
        completionRef.current = () => resolve(false);
        source.onended = () => resolve(true);
      });
      completionRef.current = null;
      if (!completedNaturally || generation !== generationRef.current) {
        throw new Error("ERA_SPEECH_CANCELLED");
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      sourceRef.current = null;
      setAudioLevel(0);
      setPlaying(false);
    },
    [ensureAudioContext, loadConfiguration, stop],
  );

  const primeAudio = useCallback(() => {
    ensureAudioContext().catch(() => {});
  }, [ensureAudioContext]);

  useEffect(() => {
    return () => {
      stop();
      audioContextRef.current?.close().catch(() => {});
    };
  }, [stop]);

  const value = useMemo(
    () => ({
      configured,
      playing,
      preparing,
      audioLevel,
      playText,
      primeAudio,
      stop,
    }),
    [configured, playing, preparing, audioLevel, playText, primeAudio, stop],
  );

  return <EraVoiceContext.Provider value={value}>{children}</EraVoiceContext.Provider>;
};

export const useEraVoice = () => {
  const context = useContext(EraVoiceContext);
  if (!context) throw new Error("useEraVoice must be used within EraVoiceProvider");
  return context;
};
