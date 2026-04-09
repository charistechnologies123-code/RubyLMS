import type { NextApiRequest, NextApiResponse } from "next";
import type { GetServerSidePropsContext, NextPageContext } from "next";
import type { Role, UserStatus } from "@prisma/client";
import jwt from "jsonwebtoken";

const SESSION_COOKIE = "rubylms_session";

export type SessionUser = {
  userId: string;
  role: Role;
  fullName: string;
  email: string;
  status: UserStatus;
  avatarUrl?: string | null;
};

type CookieOptions = {
  maxAge?: number;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

export function signSessionToken(user: SessionUser) {
  return jwt.sign(user, getJwtSecret(), { expiresIn: "7d" });
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as SessionUser;
}

function parseCookieHeader(cookieHeader?: string) {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(";").map((entry) => {
      const [key, ...value] = entry.trim().split("=");
      return [key, decodeURIComponent(value.join("="))];
    }),
  );
}

function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
}

export function setSessionCookie(res: NextApiResponse, token: string) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, token, { maxAge: 60 * 60 * 24 * 7 }),
  );
}

export function clearSessionCookie(res: NextApiResponse) {
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, "", { maxAge: 0 }));
}

export function getSessionFromApiRequest(req: NextApiRequest) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export function getSessionFromPageContext(
  ctx: GetServerSidePropsContext | NextPageContext,
) {
  const cookieHeader = "req" in ctx ? ctx.req?.headers.cookie : undefined;
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export function redirectToLogin() {
  return {
    redirect: {
      destination: "/login",
      permanent: false,
    },
  } as const;
}

export function getDefaultRouteForRole(role: Role) {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "INSTRUCTOR":
      return "/instructor";
    case "STUDENT":
      return "/student";
    default:
      return "/login";
  }
}

export function assertRoleAccess(
  session: SessionUser | null,
  roles: Role[],
) {
  return !!session && roles.includes(session.role) && session.status === "ACTIVE";
}
