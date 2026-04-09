import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiForm from "@/components/ui/ApiForm";
import AvatarUploadField from "@/components/ui/AvatarUploadField";
import Badge from "@/components/ui/Badge";
import Panel from "@/components/ui/Panel";
import FormField from "@/components/ui/FormField";
import { formatDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN", "INSTRUCTOR", "STUDENT"], async (session) => {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        studentId: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return { user: serialize(user) };
  });
}

export default function ProfilePage({
  session,
  user,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Profile"
      description="Update your avatar and password while keeping role-controlled identity fields protected."
    >
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Account Snapshot">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#6b00ff,#ff1e1e)] font-heading text-2xl text-white">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={`${user.fullName} avatar`} className="h-full w-full object-cover" />
            ) : (
              user.fullName
                .split(" ")
                .map((part: string) => part[0])
                .slice(0, 2)
                .join("")
            )}
          </div>
          <p className="mt-4 font-heading text-2xl text-slate-950">{user.fullName}</p>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="purple">{user.role}</Badge>
            <Badge tone={user.status === "ACTIVE" ? "green" : "red"}>{user.status}</Badge>
          </div>
          <div className="mt-5 space-y-2 text-sm text-slate-600">
            <p>Student ID: {user.studentId ?? "Not applicable"}</p>
            <p>Last login: {formatDate(user.lastLoginAt)}</p>
            <p>Member since: {formatDate(user.createdAt)}</p>
          </div>
        </Panel>

        <Panel title="Update My Profile">
          <ApiForm
            action="/api/profile"
            method="PATCH"
            submitLabel="Save profile"
            successMessage="Profile updated."
            resetOnSuccess={false}
            className="grid gap-4"
          >
            <AvatarUploadField label="Avatar" name="avatarUrl" defaultValue={user.avatarUrl} />
            <FormField label="New password" name="password" type="password" placeholder="Leave blank to keep current password" />
          </ApiForm>
        </Panel>
      </section>
    </DashboardLayout>
  );
}
