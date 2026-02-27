 "use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "react-qr-code";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

type Session = {
  id: string;
  createdAt?: Date | null;
  createdBy?: string | null;
  isActive: boolean;
  name?: string | null;
  imageUrl?: string | null;
};

type AdditionalMember = {
  name: string;
  phone: string;
  relation: string;
};

type User = {
  id: string;
  name: string;
  phone: string;
  email: string;
  visitType: "self" | "wife" | "family";
  createdAt?: Date | null;
  additionalMembers?: AdditionalMember[];
};

type Message = {
  id: string;
  sessionId: string;
  userId: string;
  message: string;
  timestamp?: Date | null;
};

export default function AdminPage() {
  const [origin, setOrigin] = useState("");
  const [creating, setCreating] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newSessionName, setNewSessionName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      const stored = window.localStorage.getItem("qrchat_admin_auth");
      if (stored === "ok") {
        setLoggedIn(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;

    const q = query(
      collection(db, "sessions"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Session[] = snapshot.docs.map((d) => ({
        id: d.id,
        createdAt: d.data().createdAt?.toDate?.() ?? null,
        createdBy: d.data().createdBy ?? null,
        isActive: Boolean(d.data().isActive),
        name: d.data().name ?? null,
        imageUrl: d.data().imageUrl ?? null,
      }));
      setSessions(data);
      if (!selectedSessionId && data.length > 0) {
        setSelectedSessionId(data[0].id);
        setEditingName(data[0].name ?? "");
        setPosterUrl(data[0].imageUrl ?? "");
      }
    });
    return () => unsub();
  }, [selectedSessionId, loggedIn]);

  useEffect(() => {
    if (!selectedSessionId || !loggedIn) return;

    const usersQuery = query(
      collection(db, "users"),
      where("sessionId", "==", selectedSessionId),
    );
    const messagesQuery = query(
      collection(db, "messages"),
      where("sessionId", "==", selectedSessionId),
    );

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const data: User[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        phone: doc.data().phone,
        email: doc.data().email,
        visitType: doc.data().visitType,
      }));
      setUsers(data);
    });

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const data: Message[] = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          sessionId: doc.data().sessionId,
          userId: doc.data().userId,
          message: doc.data().message,
          timestamp: doc.data().timestamp?.toDate?.() ?? null,
        }))
        .sort((a, b) => {
          const ta = a.timestamp?.getTime() ?? 0;
          const tb = b.timestamp?.getTime() ?? 0;
          return ta - tb;
        });
      setMessages(data);
    });

    return () => {
      unsubUsers();
      unsubMessages();
    };
  }, [selectedSessionId, loggedIn]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("qrchat_admin_auth");
    }
    setLoggedIn(false);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const email = loginEmail.trim().toLowerCase();
    const pass = loginPassword;
    if (email === "info@synemerge.com" && pass === "synemerge@123") {
      setLoggedIn(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("qrchat_admin_auth", "ok");
      }
      setLoginPassword("");
    } else {
      setLoginError("Invalid email or password.");
    }
  }

  async function handleRemoveImage() {
    if (!selectedSession) return;
    try {
      setSavingName(true);
      setPosterUrl("");
      await updateDoc(doc(db, "sessions", selectedSession.id), {
        imageUrl: null,
      });
    } finally {
      setSavingName(false);
    }
  }

  async function handleToggleActive() {
    if (!selectedSession) return;
    try {
      setTogglingActive(true);
      await updateDoc(doc(db, "sessions", selectedSession.id), {
        isActive: !selectedSession.isActive,
      });
    } finally {
      setTogglingActive(false);
    }
  }

  function handleDownloadQr() {
    if (!selectedSession) return;
    const svg = document.getElementById(
      "session-qr-svg",
    ) as SVGSVGElement | null;
    if (!svg) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `session-${selectedSession.id}-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handlePosterFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPoster(true);
      const fileRef = ref(
        storage,
        `session-posters/${Date.now()}-${file.name}`,
      );
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      setPosterUrl(downloadUrl);

      if (selectedSession) {
        await updateDoc(doc(db, "sessions", selectedSession.id), {
          imageUrl: downloadUrl,
        });
      }
    } catch (error) {
      console.error("Error uploading poster image", error);
    } finally {
      setUploadingPoster(false);
      // reset input so same file can be chosen again if needed
      event.target.value = "";
    }
  }

  async function handleCreateSession() {
    try {
      setCreating(true);
      const trimmedName = newSessionName.trim();
      const trimmedPoster = posterUrl.trim();
      const docRef = await addDoc(collection(db, "sessions"), {
        createdAt: serverTimestamp(),
        createdBy: "admin",
        isActive: true,
        name: trimmedName || null,
        imageUrl: trimmedPoster || null,
      });
      setSelectedSessionId(docRef.id);
      setEditingName(trimmedName || "");
      setPosterUrl(trimmedPoster || "");
      setNewSessionName("");
    } catch (error) {
      console.error("Error creating session", error);
    } finally {
      setCreating(false);
    }
  }

  const currentQrUrl =
    origin && selectedSession ? `${origin}/session/${selectedSession.id}` : "";

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      {!loggedIn ? (
        <div className="flex min-h-screen w-full items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900/80 p-6 shadow-2xl ring-1 ring-slate-800">
            <h1 className="text-lg font-semibold tracking-tight text-slate-50">
              Admin Login
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Only authorised admins can access this dashboard.
            </p>
            <form onSubmit={handleLogin} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  placeholder="Email"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  placeholder="Password"
                />
              </div>
              {loginError && (
                <p className="text-[11px] text-red-400">{loginError}</p>
              )}
              <button
                type="submit"
                className="mt-1 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400"
              >
                Sign in
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
      <aside className="hidden h-screen w-64 flex-col border-r border-slate-800 bg-slate-950/95 px-4 py-4 md:flex">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-9 w-auto">
            <Image
              src="/SyneMerge-Logo-og-1.png"
              alt="Synemerge logo"
              width={120}
              height={36}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>
         
        </div>

        <nav className="flex-1 space-y-6 text-sm">
          <div className="space-y-1">
            <button className="flex w-full items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-left text-xs font-medium text-slate-50">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-[11px] text-emerald-400">
                ●
              </span>
              <span>My Sessions</span>
            </button>
            <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[11px] text-slate-400">
                🔔
              </span>
              <span>Inbox</span>
            </button>
            <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[11px] text-slate-400">
                👥
              </span>
              <span>Visitors</span>
            </button>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              All Sessions
            </p>
            <div className="mt-1 max-h-[260px] space-y-1 overflow-y-auto rounded-xl bg-slate-900/80 p-2">
              {sessions.length === 0 && (
                <p className="px-2 py-3 text-xs text-slate-500">
                  No sessions yet. Create one to get started.
                </p>
              )}
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setSelectedSessionId(session.id);
                    setEditingName(session.name ?? "");
                    setPosterUrl(session.imageUrl ?? "");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] transition ${
                    selectedSessionId === session.id
                      ? "bg-slate-800 text-slate-50"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <span className="line-clamp-1 font-medium">
                    {session.name ? session.name : session.id.slice(0, 6)}
                  </span>
                  <span className="ml-2 flex shrink-0 items-center gap-1 text-[9px] text-slate-500">
                    {session.createdAt
                      ? session.createdAt.toLocaleTimeString()
                      : "new"}
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        session.isActive ? "bg-emerald-400" : "bg-red-500"
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <p>
              Logged in as{" "}
              <span className="font-medium text-slate-300">Admin</span>
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-red-500 hover:text-red-300"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {selectedSession?.name ?? "My Sessions"}
            </h1>
            <p className="text-xs text-slate-400">
              Create QR chat sessions and monitor visitor messages.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Session name"
              className="hidden rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 md:inline-block"
            />
            <label className="hidden items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-200 hover:border-emerald-400 md:inline-flex cursor-pointer">
              <span>{uploadingPoster ? "Uploading poster..." : "Upload poster"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePosterFileChange}
                className="hidden"
              />
            </label>
            <button
              onClick={handleCreateSession}
              disabled={creating}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-xs font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {creating ? "Creating..." : "Create New Session"}
            </button>
          </div>
        </header>

        <section className="flex flex-1 flex-col gap-4 rounded-2xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Live Messages
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Messages appear here in real-time as visitors send them.
                  </p>
                </div>
                {selectedSessionId && (
                  <div className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-medium text-slate-100">
                    People registered:{" "}
                    <span className="text-emerald-400">{users.length}</span>
                  </div>
                )}
              </div>
            </div>

            {currentQrUrl && selectedSession && (
              <div className="w-60 rounded-2xl bg-slate-950/80 p-3 ring-1 ring-slate-800/80">
                <p className="text-[11px] font-medium text-slate-100">
                  Session QR Code
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Scan to open the current session on visitor&apos;s device.
                </p>
                <div className="mt-3 flex items-center justify-center rounded-xl bg-white p-3">
                  <QRCode id="session-qr-svg" value={currentQrUrl} size={148} />
                </div>
                {selectedSession.imageUrl && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedSession.imageUrl}
                      alt={selectedSession.name ?? "Session poster"}
                      className="w-full h-auto"
                    />
                  </div>
                )}
                <p className="mt-2 line-clamp-2 break-all rounded bg-slate-900 px-2 py-1 text-[9px] font-mono text-slate-300">
                  {currentQrUrl}
                </p>

                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-300">
                      Session Name
                    </label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Add or edit session name"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[11px] text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-slate-300">
                      Poster Image URL
                    </label>
                    <input
                      type="text"
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      placeholder="https://example.com/poster.jpg"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[11px] text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.clipboard) return;
                        navigator.clipboard
                          .writeText(currentQrUrl)
                          .catch(() => {});
                      }}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-100 hover:bg-slate-700"
                    >
                      Copy Link
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-100 hover:bg-slate-700"
                    >
                      Download QR
                    </button>
                    <button
                      type="button"
                      disabled={savingName}
                      onClick={async () => {
                        if (!selectedSession) return;
                        try {
                          setSavingName(true);
                          await updateDoc(doc(db, "sessions", selectedSession.id), {
                            name: editingName.trim() || null,
                            imageUrl: posterUrl.trim() || null,
                          });
                        } finally {
                          setSavingName(false);
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-2 py-1.5 text-[10px] font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {savingName ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={togglingActive}
                      onClick={handleToggleActive}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-700 px-2 py-1.5 text-[10px] font-medium text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {togglingActive
                        ? "Updating..."
                        : selectedSession.isActive
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-700 px-2 py-1.5 text-[10px] font-medium text-slate-100 hover:bg-slate-600"
                    >
                      Remove Image
                    </button>
                    <button
                      type="button"
                      disabled={deletingSession}
                      onClick={async () => {
                        if (!selectedSession) return;
                        const ok = window.confirm(
                          "Delete this session? The QR link will no longer be valid."
                        );
                        if (!ok) return;
                        try {
                          setDeletingSession(true);
                          await deleteDoc(doc(db, "sessions", selectedSession.id));
                          setSelectedSessionId("");
                          setEditingName("");
                        } finally {
                          setDeletingSession(false);
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-lg bg-red-600/80 px-2 py-1.5 text-[10px] font-medium text-slate-50 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deletingSession ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2 rounded-xl bg-slate-950/60 p-4 ring-1 ring-slate-800/60 min-h-[260px]">
              {selectedSessionId ? (
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[520px]">
                  {messages.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
                      No messages for this session yet. Messages will appear here in real-time.
                    </div>
                  ) : (
                    messages.map((msg) => {
                    const user = userById.get(msg.userId);
                    return (
                      <div
                        key={msg.id}
                        className="rounded-lg bg-slate-900/80 p-3 text-xs text-slate-100"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {user?.name ?? "Unknown User"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {user?.visitType === "self" && "Self"}
                              {user?.visitType === "wife" && "With Wife"}
                              {user?.visitType === "family" &&
                                "With Friend & Family"}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {msg.timestamp
                              ? msg.timestamp.toLocaleTimeString()
                              : ""}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-100">
                          {msg.message}
                        </p>
                      </div>
                    );
                    })
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  Select or create a session to view messages.
                </div>
              )}
            </div>

            <div className="rounded-xl bg-slate-950/60 p-4 ring-1 ring-slate-800/60">
              <h3 className="text-xs font-semibold text-slate-100">
                Registered People
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Tap a person to see full details.
              </p>
              <div className="mt-3 flex h-[420px] flex-col gap-3 sm:flex-row">
                <div className="space-y-1 overflow-y-auto pr-1 sm:w-1/2">
                  {users.length === 0 ? (
                    <p className="mt-4 text-[11px] text-slate-500">
                      No registrations yet for this session.
                    </p>
                  ) : (
                    users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`w-full rounded-lg px-2 py-2 text-left text-[11px] ${
                          selectedUserId === u.id
                            ? "bg-slate-800 text-slate-50"
                            : "bg-slate-900/80 text-slate-200 hover:bg-slate-900"
                        }`}
                      >
                        <p className="line-clamp-1 font-medium">{u.name}</p>
                        <p className="text-[10px] text-slate-400">{u.phone}</p>
                      </button>
                    ))
                  )}
                </div>
                <div className="overflow-y-auto rounded-lg bg-slate-900/80 p-3 text-[11px] text-slate-100 sm:w-1/2">
                  {selectedUser ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">{selectedUser.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {selectedUser.visitType === "self" && "Self"}
                        {selectedUser.visitType === "wife" && "With Wife"}
                        {selectedUser.visitType === "family" &&
                          "With Friend & Family"}
                      </p>
                      <p className="mt-2">
                        <span className="font-medium">Phone:</span>{" "}
                        {selectedUser.phone}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span>{" "}
                        {selectedUser.email}
                      </p>
                      {selectedUser.createdAt && (
                        <p>
                          <span className="font-medium">Registered at:</span>{" "}
                          {selectedUser.createdAt.toLocaleString()}
                        </p>
                      )}
                      {selectedUser.additionalMembers &&
                        selectedUser.additionalMembers.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium">Additional members:</p>
                            <ul className="mt-1 space-y-1">
                              {selectedUser.additionalMembers.map((m, idx) => (
                                <li
                                  key={`${m.name}-${idx}`}
                                  className="text-[10px] text-slate-300"
                                >
                                  {m.relation}: {m.name} ({m.phone})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Select a person from the list to see details.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      </>
      )}
    </div>
  );
}

