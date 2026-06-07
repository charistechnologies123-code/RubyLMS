import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Toaster } from "react-hot-toast";
import { bodyFont, headingFont, subheadingFont } from "@/lib/fonts";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleStart = () => setLoading(true);
    const handleStop = () => setLoading(false);

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleStop);
    router.events.on("routeChangeError", handleStop);

    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleStop);
      router.events.off("routeChangeError", handleStop);
    };
  }, [router.events]);

  return (
    <div
      className={`${headingFont.variable} ${subheadingFont.variable} ${bodyFont.variable}`}
    >
      {loading ? <RouteLoader /> : null}
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "18px",
            border: "1px solid #eee7ff",
            background: "#ffffff",
            color: "#140a2d",
          },
        }}
      />
    </div>
  );
}

function RouteLoader() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(20,10,45,0.2)] px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-[0_24px_80px_rgba(70,16,130,0.2)]">
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Ruby LMS" className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-[#6b00ff]" />
            <div className="h-3 w-3 animate-pulse rounded-full bg-[#8c3cff] [animation-delay:150ms]" />
            <div className="h-3 w-3 animate-pulse rounded-full bg-[#ff6b6b] [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
