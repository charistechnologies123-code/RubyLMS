"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { formatElapsedTime, getRequiredSeconds } from "@/lib/courseProgress";

type PageCompletionTrackerProps = {
  lessonPageId: string;
  estimatedDurationMinutes: number | null;
  initialTimeSpentSeconds: number;
  initiallyCompleted: boolean;
};

export default function PageCompletionTracker({
  lessonPageId,
  estimatedDurationMinutes,
  initialTimeSpentSeconds,
  initiallyCompleted,
}: PageCompletionTrackerProps) {
  const [savedTimeSpentSeconds, setSavedTimeSpentSeconds] = useState(initialTimeSpentSeconds);
  const [pendingSeconds, setPendingSeconds] = useState(0);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [saving, setSaving] = useState(false);
  const pendingSecondsRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const requiredSeconds = useMemo(
    () => getRequiredSeconds(estimatedDurationMinutes),
    [estimatedDurationMinutes],
  );

  useEffect(() => {
    setSavedTimeSpentSeconds(initialTimeSpentSeconds);
    setCompleted(initiallyCompleted);
    setSaving(false);
    updatePending(0);
  }, [initialTimeSpentSeconds, initiallyCompleted, lessonPageId]);

  function updatePending(nextValue: number) {
    pendingSecondsRef.current = nextValue;
    setPendingSeconds(nextValue);
  }

  async function saveProgress(extra: { markDone?: boolean; silent?: boolean } = {}) {
    if (saveInFlightRef.current) {
      return false;
    }

    const secondsToSend = pendingSecondsRef.current;

    if (!extra.markDone && secondsToSend <= 0) {
      return true;
    }

    saveInFlightRef.current = true;

    try {
      const response = await fetch("/api/lesson-progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonPageId,
          secondsSpent: secondsToSend,
          markDone: extra.markDone ?? false,
        }),
        keepalive: true,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (!extra.silent) {
          toast.error(result.error ?? "Unable to save page progress.");
        }
        return false;
      }

      setSavedTimeSpentSeconds((currentValue) => result.progress?.timeSpentSeconds ?? currentValue + secondsToSend);
      updatePending(0);

      if (result.progress?.completed) {
        setCompleted(true);
      }

      if (extra.markDone && !extra.silent) {
        toast.success("Page marked as done.");
      }

      return true;
    } catch {
      if (!extra.silent) {
        toast.error("Unable to save page progress.");
      }
      return false;
    } finally {
      saveInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (completed) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    function startTicker() {
      if (intervalId) {
        return;
      }

      intervalId = setInterval(() => {
        if (document.visibilityState !== "visible") {
          return;
        }

        updatePending(pendingSecondsRef.current + 1);
      }, 1000);
    }

    function stopTicker() {
      if (!intervalId) {
        return;
      }

      clearInterval(intervalId);
      intervalId = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        startTicker();
        return;
      }

      void saveProgress({ silent: true });
      stopTicker();
    }

    function handlePageHide() {
      void saveProgress({ silent: true });
    }

    startTicker();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      stopTicker();
      void saveProgress({ silent: true });
    };
  }, [completed, lessonPageId]);

  useEffect(() => {
    if (!pendingSeconds) {
      return;
    }

    if (pendingSeconds % 15 !== 0) {
      return;
    }

    void saveProgress({ silent: true });
  }, [pendingSeconds]);

  const currentTimeSpentSeconds = savedTimeSpentSeconds + pendingSeconds;
  const canMarkDone = completed || currentTimeSpentSeconds >= requiredSeconds;

  return (
    <div className="rounded-[24px] border border-[#efe6ff] bg-[#faf7ff] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${completed ? "bg-[#e7f6eb] text-[#1e7a35]" : "bg-white text-slate-600"}`}>
          {completed ? "Done" : "Yet to do"}
        </span>
        <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          Estimated {estimatedDurationMinutes && estimatedDurationMinutes > 0 ? `${estimatedDurationMinutes} min` : "No limit"}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Time spent: <span className="font-semibold text-slate-950">{formatElapsedTime(currentTimeSpentSeconds)}</span>
        {requiredSeconds > 0 ? (
          <>
            {" "}
            of <span className="font-semibold text-slate-950">{formatElapsedTime(requiredSeconds)}</span> required
          </>
        ) : null}
      </p>

      {!completed && requiredSeconds > 0 && !canMarkDone ? (
        <p className="mt-2 text-sm text-[#b42318]">
          Please spend the required time on this page before marking it as done.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={completed || saving}
          onClick={async () => {
            if (!canMarkDone) {
              toast.error("Please go through all the page contents before marking this page as done.");
              return;
            }

            setSaving(true);
            const success = await saveProgress({ markDone: true });
            setSaving(false);

            if (!success) {
              return;
            }
          }}
          className={`inline-flex rounded-2xl px-5 py-3 text-sm font-semibold transition ${
            completed
              ? "cursor-not-allowed bg-[#e7f6eb] text-[#1e7a35]"
              : canMarkDone
                ? "bg-[linear-gradient(135deg,#159957,#38ef7d)] text-white"
                : "cursor-not-allowed border border-[#f1d2d2] bg-[#fff5f5] text-[#b42318]"
          }`}
        >
          {completed ? "Marked as Done" : saving ? "Saving..." : "Mark as Done"}
        </button>
      </div>
    </div>
  );
}
