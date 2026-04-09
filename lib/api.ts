import type { NextApiRequest, NextApiResponse } from "next";
import type { Role } from "@prisma/client";
import { assertRoleAccess, getSessionFromApiRequest, type SessionUser } from "@/lib/auth";

export type AuthedNextApiRequest = NextApiRequest & {
  session: SessionUser;
};

type AuthedHandler = (
  req: AuthedNextApiRequest,
  res: NextApiResponse,
) => void | Promise<void>;

export function withApiAuth(handler: AuthedHandler, roles?: Role[]) {
  return async function authenticatedHandler(
    req: NextApiRequest,
    res: NextApiResponse,
  ) {
    const session = getSessionFromApiRequest(req);

    if (!session || (roles && !assertRoleAccess(session, roles))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const authedReq = req as AuthedNextApiRequest;
    authedReq.session = session;
    return handler(authedReq, res);
  };
}
