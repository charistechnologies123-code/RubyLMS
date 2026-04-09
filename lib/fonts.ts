import { Montserrat, Open_Sans, Poppins } from "next/font/google";

export const headingFont = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700", "800"],
});

export const subheadingFont = Poppins({
  subsets: ["latin"],
  variable: "--font-subheading",
  weight: ["500", "600", "700"],
});

export const bodyFont = Open_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});
