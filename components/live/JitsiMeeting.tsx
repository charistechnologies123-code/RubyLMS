"use client";

import { useEffect, useRef, useState } from "react";

type JitsiMeetingProps = {
  roomName: string;
  displayName: string;
  email?: string | null;
  className?: string;
};

type JitsiApi = {
  dispose: () => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
  }
}

const JITSI_DOMAIN = "meet.jit.si";

export default function JitsiMeeting({ roomName, displayName, email, className = "" }: JitsiMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (window.JitsiMeetExternalAPI) {
      setScriptReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = () => setScriptReady(true);
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.JitsiMeetExternalAPI) {
      return;
    }

    apiRef.current?.dispose();
    containerRef.current.innerHTML = "";

    apiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName,
      parentNode: containerRef.current,
      width: "100%",
      height: "100%",
      userInfo: {
        displayName,
        email: email ?? undefined,
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithVideoMuted: false,
        startWithAudioMuted: false,
        disableInviteFunctions: true,
      },
    });

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [displayName, email, roomName, scriptReady]);

  return <div ref={containerRef} className={`h-[calc(100vh-18rem)] min-h-[560px] w-full overflow-hidden rounded-[28px] border border-[#e8ddff] bg-black shadow-[0_20px_70px_rgba(74,15,144,0.16)] ${className}`} />;
}

