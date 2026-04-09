import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import type { Role } from "@prisma/client";
import {
  assertRoleAccess,
  getDefaultRouteForRole,
  getSessionFromPageContext,
  redirectToLogin,
  type SessionUser,
} from "@/lib/auth";

export async function requirePageAuth<T extends Record<string, unknown>>(
  ctx: GetServerSidePropsContext,
  roles: Role[],
  getProps: (session: SessionUser) => Promise<T>,
): Promise<GetServerSidePropsResult<T & { session: SessionUser }>> {
  const session = getSessionFromPageContext(ctx);

  if (!session) {
    return redirectToLogin();
  }

  if (!assertRoleAccess(session, roles)) {
    return {
      redirect: {
        destination: getDefaultRouteForRole(session.role),
        permanent: false,
      },
    };
  }

  const props = await getProps(session);

  return {
    props: {
      ...props,
      session,
    },
  };
}
