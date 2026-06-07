import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import { MessageSquarePlus, Send } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { assertRoleAccess, getDefaultRouteForRole, getSessionFromPageContext } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

type ChatUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: ChatUser;
};

type ChatRoom = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string | null;
  lastMessageAt: string | null;
  createdBy: ChatUser;
  members: Array<{
    user: ChatUser;
  }>;
  messages: ChatMessage[];
};

type ChatProps = {
  session: NonNullable<ReturnType<typeof getSessionFromPageContext>>;
  rooms: ChatRoom[];
  selectedRoom: ChatRoom | null;
  users: ChatUser[];
  loadError?: string | null;
};

function getRoomLabel(room: Pick<ChatRoom, "type" | "title" | "members">, currentUserId: string) {
  if (room.type === "GROUP") {
    return room.title || "Group chat";
  }

  const otherMember = room.members.find((member) => member.user.id !== currentUserId);
  return otherMember?.user.fullName || "Private chat";
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const session = getSessionFromPageContext(ctx);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  if (!assertRoleAccess(session, ["ADMIN", "INSTRUCTOR", "STUDENT"])) {
    return {
      redirect: {
        destination: getDefaultRouteForRole(session.role),
        permanent: false,
      },
    };
  }

  const roomId = typeof ctx.query.roomId === "string" ? ctx.query.roomId : null;

  try {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: session.userId,
          },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            role: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    const selectedRoomId = roomId ?? rooms[0]?.id ?? null;
    const selectedRoom = selectedRoomId
      ? await prisma.chatRoom.findFirst({
        where: {
          id: selectedRoomId,
          members: {
            some: {
              userId: session.userId,
            },
          },
        },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatarUrl: true,
                  role: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sender: {
                select: {
                  id: true,
                  fullName: true,
                  avatarUrl: true,
                  role: true,
                },
              },
            },
          },
        },
      })
      : null;

    const users = await prisma.user.findMany({
      where: {
        archivedAt: null,
        id: {
          not: session.userId,
        },
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: {
        fullName: "asc",
      },
    });

    return {
      props: {
        session,
        rooms: serialize(rooms),
        selectedRoom: serialize(selectedRoom),
        users: serialize(users),
        loadError: null,
      },
    };
  } catch (error) {
    return {
      props: {
        session,
        rooms: [],
        selectedRoom: null,
        users: [],
        loadError:
          error instanceof Error
            ? error.message
            : "Chat storage is not ready yet. Please run the chat migration against Neon.",
      },
    };
  }
}

export default function ChatPage({
  session,
  rooms,
  selectedRoom,
  users,
  loadError,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const selectedRoomId = selectedRoom?.id ?? null;
  const [roomType, setRoomType] = useState<"DIRECT" | "GROUP">("DIRECT");
  const [roomTitle, setRoomTitle] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selectedRoomId, selectedRoom?.messages.length]);

  const selectedRoomLabel = useMemo(() => {
    if (!selectedRoom) {
      return "No room selected";
    }

    return getRoomLabel(selectedRoom, session.userId);
  }, [selectedRoom, session.userId]);

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingRoom(true);

    if (roomType === "DIRECT" && selectedMemberIds.length !== 1) {
      window.alert("Select exactly one person for a private chat.");
      setCreatingRoom(false);
      return;
    }

    if (roomType === "GROUP" && (!roomTitle.trim() || !selectedMemberIds.length)) {
      window.alert("Enter a group title and select at least one member.");
      setCreatingRoom(false);
      return;
    }

    const response = await fetch("/api/chat/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: roomType,
        title: roomTitle,
        memberIds: selectedMemberIds,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      window.alert(result.error ?? "Unable to create chat room.");
      setCreatingRoom(false);
      return;
    }

    setCreatingRoom(false);
    setRoomTitle("");
    setSelectedMemberIds([]);
    await router.push(`/chat?roomId=${result.room.id}`);
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRoom) {
      return;
    }

    const trimmedBody = messageBody.trim();
    if (!trimmedBody) {
      return;
    }

    setSendingMessage(true);

    const response = await fetch(`/api/chat/rooms/${selectedRoom.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: trimmedBody }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      window.alert(result.error ?? "Unable to send message.");
      setSendingMessage(false);
      return;
    }

    setMessageBody("");
    setSendingMessage(false);
    await router.replace(router.asPath);
  }

  return (
    <DashboardLayout
      role={session.role}
      session={session}
      title="Chat"
      description="Private and group chat live here so you can keep conversations separate from lessons and assessments."
    >
      {loadError ? (
        <Panel className="mb-6" title="Chat not ready yet" subtitle="The chat tables need to match the app schema.">
          <p className="text-sm text-slate-700">{loadError}</p>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Rooms" subtitle="Select a private or group chat.">
          <div className="space-y-3">
            {rooms.length ? (
              rooms.map((room) => {
                const isActive = room.id === selectedRoomId;

                return (
                  <Link
                    key={room.id}
                    href={`/chat?roomId=${room.id}`}
                    className={`block rounded-[22px] border p-4 transition ${
                      isActive
                        ? "border-[#6b00ff] bg-[#faf7ff]"
                        : "border-[#efe6ff] bg-white hover:border-[#d9c2ff]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{getRoomLabel(room, session.userId)}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {room.type === "DIRECT" ? "Private chat" : "Group chat"}
                        </p>
                      </div>
                      <Badge tone={room.type === "DIRECT" ? "purple" : "green"}>{room.type}</Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                      {room.messages[0]?.body || "No messages yet."}
                    </p>
                    {room.lastMessageAt ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {formatDate(room.lastMessageAt)}
                      </p>
                    ) : null}
                  </Link>
                );
              })
            ) : (
              <EmptyState title="No chats yet" description="Create a private chat or start a group conversation." />
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title={selectedRoomLabel} subtitle={selectedRoom ? "Conversation workspace" : "No chat selected yet"}>
            {selectedRoom ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={selectedRoom.type === "DIRECT" ? "purple" : "green"}>{selectedRoom.type}</Badge>
                  <Badge tone="slate">{selectedRoom.members.length} member(s)</Badge>
                </div>
                <div className="max-h-[56vh] space-y-3 overflow-y-auto rounded-[24px] border border-[#efe6ff] bg-[#fcfaff] p-4">
                  {selectedRoom.messages.length ? (
                    selectedRoom.messages.map((message) => {
                      const isOwnMessage = message.sender.id === session.userId;

                      return (
                        <article
                          key={message.id}
                          className={`max-w-[85%] rounded-[22px] px-4 py-3 ${
                            isOwnMessage ? "ml-auto bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white" : "bg-white text-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className={`text-sm font-semibold ${isOwnMessage ? "text-white" : "text-slate-950"}`}>
                              {message.sender.fullName}
                            </p>
                            <p className={`text-xs ${isOwnMessage ? "text-white/80" : "text-slate-500"}`}>
                              {formatDate(message.createdAt)}
                            </p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                        </article>
                      );
                    })
                  ) : (
                    <EmptyState title="No messages yet" description="Send the first message to start the conversation." />
                  )}
                  <div ref={bottomRef} />
                </div>

                <form className="space-y-3" onSubmit={handleSendMessage}>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Message</span>
                    <textarea
                      value={messageBody}
                      onChange={(event) => setMessageBody(event.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-[22px] border border-[#e8ddff] bg-white px-4 py-3 text-slate-950 outline-none focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]"
                      placeholder="Write a message..."
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={sendingMessage}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send size={16} />
                    {sendingMessage ? "Sending..." : "Send message"}
                  </button>
                </form>
              </div>
            ) : (
              <EmptyState title="No room selected" description="Create or choose a chat room from the list on the left." />
            )}
          </Panel>

          <Panel
            title="Start a chat"
            subtitle="Create a private chat with one person or a group chat with several members."
          >
            <form className="grid gap-4" onSubmit={handleCreateRoom}>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setRoomType("DIRECT");
                    setRoomTitle("");
                    setSelectedMemberIds([]);
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    roomType === "DIRECT"
                      ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                      : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                  }`}
                >
                  Private chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRoomType("GROUP");
                    setRoomTitle("");
                    setSelectedMemberIds([]);
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    roomType === "GROUP"
                      ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                      : "border border-[#e8ddff] bg-white text-[#6b00ff]"
                  }`}
                >
                  Group chat
                </button>
              </div>

              {roomType === "GROUP" ? (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Group title</span>
                  <input
                    type="text"
                    value={roomTitle}
                    onChange={(event) => setRoomTitle(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-slate-950 outline-none focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]"
                    placeholder="Study group, class project, team chat..."
                  />
                </label>
              ) : null}

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {roomType === "DIRECT" ? "Select one person" : "Select members"}
                </p>
                <div className="mt-2 max-h-[280px] space-y-2 overflow-y-auto rounded-[22px] border border-[#e8ddff] bg-white p-4">
                  {users.length ? (
                    users.map((user) => {
                      const checked = selectedMemberIds.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm text-slate-700 hover:bg-[#faf7ff]"
                        >
                          <input
                            type={roomType === "DIRECT" ? "radio" : "checkbox"}
                            name={roomType === "DIRECT" ? "directMemberId" : "memberIds"}
                            checked={checked}
                            onChange={() => {
                              if (roomType === "DIRECT") {
                                setSelectedMemberIds([user.id]);
                                return;
                              }

                              setSelectedMemberIds((current) =>
                                current.includes(user.id)
                                  ? current.filter((memberId) => memberId !== user.id)
                                  : [...current, user.id],
                              );
                            }}
                          />
                          <span className="flex-1">
                            {user.fullName}
                            <span className="ml-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                              {user.role}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-600">No available users.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={creatingRoom}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageSquarePlus size={16} />
                  {creatingRoom ? "Creating..." : "Start chat"}
                </button>
                <p className="text-sm text-slate-500">
                  {roomType === "DIRECT" ? "Private chats keep one-to-one messages separate." : "Group chats are best for projects and class discussion."}
                </p>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
}
