/**
 * Records meeting audio for Whisper.
 *
 * Prefers sharing the current tab (captures what you hear from Jitsi).
 * Falls back to microphone-only if tab audio is denied or unavailable.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingMode = "idle" | "starting" | "tab" | "mic" | "stopped";

export interface MeetingRecorderState {
  mode: RecordingMode;
  elapsedSec: number;
  error: string | null;
  supported: boolean;
}

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }
  return undefined;
}

async function getTabAudioStream(): Promise<MediaStream> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
    // Chrome / Edge hints — ignored elsewhere.
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    systemAudio: "include",
  } as DisplayMediaStreamOptions & {
    preferCurrentTab?: boolean;
    selfBrowserSurface?: string;
    systemAudio?: string;
  });

  const audioTracks = display.getAudioTracks();
  // Stop video tracks — Whisper only needs audio; keeps file small.
  for (const track of display.getVideoTracks()) {
    track.stop();
  }

  if (audioTracks.length === 0) {
    display.getTracks().forEach((track) => track.stop());
    throw new Error(
      "No tab audio. When sharing, enable “Share tab audio” / “Share system audio”."
    );
  }

  return new MediaStream(audioTracks);
}

async function getMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
    video: false,
  });
}

export function useMeetingRecorder(enabled: boolean) {
  const [mode, setMode] = useState<RecordingMode>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const mimeRef = useRef<string | undefined>(undefined);
  const tickRef = useRef<number | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!supported) {
      setError("This browser cannot record audio.");
      return;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      return;
    }

    setError(null);
    setMode("starting");
    setElapsedSec(0);
    chunksRef.current = [];

    let stream: MediaStream;
    let nextMode: RecordingMode = "tab";
    try {
      stream = await getTabAudioStream();
    } catch (tabErr) {
      try {
        stream = await getMicStream();
        nextMode = "mic";
        setError(
          tabErr instanceof Error
            ? `${tabErr.message} Using microphone only — remote speakers may be quiet.`
            : "Using microphone only — share tab audio for a full transcript."
        );
      } catch {
        setMode("idle");
        setError(
          "Could not start recording. Allow microphone or share this tab with audio."
        );
        return;
      }
    }

    streamRef.current = stream;
    const mime = pickMimeType();
    mimeRef.current = mime;

    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64_000 })
      : new MediaRecorder(stream);

    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      setError("Recording failed unexpectedly.");
    };

    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          try {
            recorderRef.current.stop();
          } catch {
            /* already stopped */
          }
        }
      });
    }

    recorder.start(2000);
    startedAtRef.current = Date.now();
    setMode(nextMode);
    clearTick();
    tickRef.current = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
  }, [supported, clearTick]);

  const stop = useCallback(async (): Promise<File | null> => {
    const recorder = recorderRef.current;
    clearTick();

    if (!recorder || recorder.state === "inactive") {
      cleanupStream();
      setMode("stopped");
      if (chunksRef.current.length === 0) return null;
      const blob = new Blob(chunksRef.current, {
        type: mimeRef.current || "audio/webm",
      });
      chunksRef.current = [];
      return new File([blob], `meeting-${Date.now()}.webm`, {
        type: blob.type || "audio/webm",
      });
    }

    const file = await new Promise<File | null>((resolve) => {
      recorder.onstop = () => {
        cleanupStream();
        recorderRef.current = null;
        const parts = chunksRef.current;
        chunksRef.current = [];
        if (parts.length === 0) {
          resolve(null);
          return;
        }
        const blob = new Blob(parts, { type: mimeRef.current || "audio/webm" });
        resolve(
          new File([blob], `meeting-${Date.now()}.webm`, {
            type: blob.type || "audio/webm",
          })
        );
      };
      try {
        recorder.requestData();
      } catch {
        /* ignore */
      }
      recorder.stop();
    });

    setMode("stopped");
    return file;
  }, [cleanupStream, clearTick]);

  useEffect(() => {
    if (!enabled) return;
    void start();
    return () => {
      clearTick();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      cleanupStream();
    };
    // Start once when the room opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only
  }, [enabled]);

  return {
    mode,
    elapsedSec,
    error,
    supported,
    start,
    stop,
    setError,
  } satisfies MeetingRecorderState & {
    start: () => Promise<void>;
    stop: () => Promise<File | null>;
    setError: (value: string | null) => void;
  };
}

export function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
