import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type JwtPayload = {
  role?: string;
};

function base64UrlToUint8Array(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64UrlToString(value: string) {
  return new TextDecoder().decode(base64UrlToUint8Array(value));
}

async function verifyAdminSession(token: string, secret: string) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  try {
    const header = JSON.parse(base64UrlToString(encodedHeader)) as { alg?: string };
    const payload = JSON.parse(base64UrlToString(encodedPayload)) as JwtPayload;

    if (header.alg !== "HS256" || payload.role !== "ADMIN") {
      return false;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    return crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToUint8Array(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const maintenanceEnabled = process.env.MAINTENANCE_MODE === "true";

  if (!maintenanceEnabled) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (
    pathname === "/maintenance" ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get("rubylms_session")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (sessionToken && jwtSecret) {
    const isAdmin = await verifyAdminSession(sessionToken, jwtSecret);

    if (isAdmin) {
      return NextResponse.next();
    }
  }

  return NextResponse.redirect(new URL("/maintenance", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
