import type { AppProps } from "next/app";
import { Toaster } from "react-hot-toast";
import { bodyFont, headingFont, subheadingFont } from "@/lib/fonts";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div
      className={`${headingFont.variable} ${subheadingFont.variable} ${bodyFont.variable}`}
    >
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
