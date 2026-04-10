import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ApiActionButton from "@/components/ui/ApiActionButton";
import ApiForm from "@/components/ui/ApiForm";
import AvatarUploadField from "@/components/ui/AvatarUploadField";
import Badge from "@/components/ui/Badge";
import FormField from "@/components/ui/FormField";
import Panel from "@/components/ui/Panel";
import { formatShortDate } from "@/lib/format";
import { requirePageAuth } from "@/lib/pageAuth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  return requirePageAuth(ctx, ["ADMIN"], async () => {
    const users = await prisma.user.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        studentId: true,
        archivedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return { users: serialize(users) };
  });
}

export default function UsersPage({
  session,
  users,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
  const studentCount = users.filter((user) => user.role === "STUDENT").length;
  const instructorCount = users.filter((user) => user.role === "INSTRUCTOR").length;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;

  return (
    <DashboardLayout
      role="ADMIN"
      session={session}
      title="Users"
      description="Admins create, activate, deactivate, and maintain student and instructor accounts."
    >
      <Panel
        title="Create User"
        subtitle="Student IDs can be system-generated or set explicitly by an admin."
        className="mb-6"
      >
        <ApiForm
          action="/api/users"
          submitLabel="Create user"
          successMessage="User created."
          className="grid gap-4 md:grid-cols-2"
        >
          <FormField label="Full name" name="fullName" required />
          <FormField label="Email" name="email" type="email" required />
          <FormField label="Password" name="password" type="password" required />
          <FormField
            label="Role"
            name="role"
            as="select"
            defaultValue="STUDENT"
            options={[
              { label: "Student", value: "STUDENT" },
              { label: "Instructor", value: "INSTRUCTOR" },
              { label: "Admin", value: "ADMIN" },
            ]}
          />
          <FormField
            label="Status"
            name="status"
            as="select"
            defaultValue="ACTIVE"
            options={[
              { label: "Active", value: "ACTIVE" },
              { label: "Inactive", value: "INACTIVE" },
            ]}
          />
          <FormField label="Student ID" name="studentId" placeholder="Optional for students only" />
          <div className="md:col-span-2">
            <AvatarUploadField label="Avatar" name="avatarUrl" />
          </div>
        </ApiForm>
      </Panel>

      <Panel title="All Users" subtitle="Open any account to review profile details and save admin edits.">
        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-[24px] border border-[#efe6ff] bg-[#faf7ff] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total users</p>
            <p className="mt-2 font-heading text-3xl text-slate-950">{users.length}</p>
          </div>
          <div className="rounded-[24px] border border-[#efe6ff] bg-[#faf7ff] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active accounts</p>
            <p className="mt-2 font-heading text-3xl text-slate-950">{activeUsers}</p>
          </div>
          <div className="rounded-[24px] border border-[#efe6ff] bg-[#faf7ff] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Students</p>
            <p className="mt-2 font-heading text-3xl text-slate-950">{studentCount}</p>
          </div>
          <div className="rounded-[24px] border border-[#efe6ff] bg-[#faf7ff] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Staff</p>
            <p className="mt-2 font-heading text-3xl text-slate-950">{instructorCount + adminCount}</p>
          </div>
        </div>

        <div className="space-y-3">
          {users.map((user) => (
            <details
              key={user.id}
              className="group rounded-[24px] border border-[#efe6ff] bg-white p-4 open:shadow-[0_18px_45px_rgba(74,15,144,0.08)]"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{user.fullName}</p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {user.role === "STUDENT" ? `Student ID: ${user.studentId ?? "N/A"} | ` : ""}
                      Last login: {formatShortDate(user.lastLoginAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={user.role === "ADMIN" ? "purple" : user.role === "INSTRUCTOR" ? "green" : "slate"}>
                      {user.role}
                    </Badge>
                    <Badge tone={user.status === "ACTIVE" ? "green" : "red"}>{user.status}</Badge>
                    <span className="rounded-full bg-[#f6f0ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b00ff] transition group-open:bg-[#ede1ff]">
                      View details
                    </span>
                  </div>
                </div>
              </summary>

              <div className="mt-5 grid gap-5 border-t border-[#f3ecff] pt-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] bg-[#faf7ff] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">User ID</p>
                    <p className="mt-2 break-all text-sm font-semibold text-slate-900">{user.id}</p>
                  </div>
                  <div className="rounded-[20px] bg-[#faf7ff] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Created</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatShortDate(user.createdAt)}</p>
                  </div>
                  <div className="rounded-[20px] bg-[#faf7ff] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last login</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatShortDate(user.lastLoginAt)}</p>
                  </div>
                  <div className="rounded-[20px] bg-[#faf7ff] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Avatar</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#ff1e1e)] text-xs font-semibold text-white">
                        {user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatarUrl} alt={`${user.fullName} avatar`} className="h-full w-full object-cover" />
                        ) : (
                          user.fullName
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {user.avatarUrl ? "Custom avatar uploaded" : "Not set"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#efe6ff] bg-[#fcfbff] p-4">
                  <div className="mb-4">
                    <p className="font-heading text-xl text-slate-950">Edit User</p>
                    <p className="text-sm text-slate-600">
                      Update core profile details, role, status, and optionally set a new password.
                    </p>
                  </div>

                  <ApiForm
                    action={`/api/users/${user.id}`}
                    method="PATCH"
                    submitLabel="Save changes"
                    successMessage="User updated."
                    resetOnSuccess={false}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    <FormField label="Full name" name="fullName" defaultValue={user.fullName} required />
                    <FormField label="Email" name="email" type="email" defaultValue={user.email} required />
                    <FormField
                      label="Role"
                      name="role"
                      as="select"
                      defaultValue={user.role}
                      options={[
                        { label: "Student", value: "STUDENT" },
                        { label: "Instructor", value: "INSTRUCTOR" },
                        { label: "Admin", value: "ADMIN" },
                      ]}
                    />
                    <FormField
                      label="Status"
                      name="status"
                      as="select"
                      defaultValue={user.status}
                      options={[
                        { label: "Active", value: "ACTIVE" },
                        { label: "Inactive", value: "INACTIVE" },
                      ]}
                    />
                    {user.role === "STUDENT" ? (
                      <FormField
                        label="Student ID"
                        name="studentId"
                        defaultValue={user.studentId ?? ""}
                        placeholder="Only used for student accounts"
                      />
                    ) : null}
                    <FormField
                      label="New password"
                      name="password"
                      type="password"
                      placeholder="Leave blank to keep current password"
                    />
                    <div className="md:col-span-2">
                      <AvatarUploadField label="Avatar" name="avatarUrl" defaultValue={user.avatarUrl} />
                    </div>
                  </ApiForm>

                  <div className="mt-5 border-t border-[#f1e8ff] pt-4">
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-slate-900">Archive User</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Archived users remain in the system but cannot sign in until restored.
                      </p>
                      <div className="mt-3">
                        <ApiActionButton
                          action={`/api/users/${user.id}`}
                          method="PATCH"
                          payload={{ archived: true }}
                          successMessage="User archived."
                          label="Archive user"
                          pendingLabel="Archiving..."
                          disabled={user.id === session.userId}
                          tone="default"
                        />
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-slate-900">Permanent delete</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Permanent deletion is only available from Admin Archives after a user has been archived.
                    </p>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Panel>
    </DashboardLayout>
  );
}
