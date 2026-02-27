"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type VisitType = "self" | "wife" | "family";

type RegistrationFormState = {
  name: string;
  phone: string;
  email: string;
  visitType: VisitType;
  wifeName: string;
  wifePhone: string;
  memberName: string;
  memberPhone: string;
};

type FormErrors = Partial<Record<keyof RegistrationFormState, string>>;

type SessionInfo = {
  name?: string | null;
  imageUrl?: string | null;
};

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;

  const [form, setForm] = useState<RegistrationFormState>({
    name: "",
    phone: "",
    email: "",
    visitType: "self",
    wifeName: "",
    wifePhone: "",
    memberName: "",
    memberPhone: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  const requiresWifeFields = form.visitType === "wife";
  const requiresMemberFields = form.visitType === "family";

  useEffect(() => {
    async function validateSession() {
      if (!sessionId) return;
      try {
        const sessionRef = doc(db, "sessions", sessionId);
        const snap = await getDoc(sessionRef);
        if (!snap.exists() || snap.data().isActive === false) {
          setSessionValid(false);
        } else {
          setSessionValid(true);
          setSessionInfo({
            name: snap.data().name ?? null,
            imageUrl: snap.data().imageUrl ?? null,
          });
        }
      } catch (error) {
        console.error("Error validating session", error);
        setSessionValid(false);
      }
    }
    validateSession();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(
      `qrchat_user_${sessionId}`,
    );
    if (stored) {
      setRegisteredUserId(stored);
    }
  }, [sessionId]);

  function handleChange(
    field: keyof RegistrationFormState,
    value: string,
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const isFormDisabled = useMemo(
    () => submitting || sessionValid === false,
    [submitting, sessionValid],
  );

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = "Full name is required";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required";
    if (!form.email.trim()) nextErrors.email = "Email is required";

    if (form.visitType === "wife") {
      if (!form.wifeName.trim()) {
        nextErrors.wifeName = "Wife name is required";
      }
      if (!form.wifePhone.trim()) {
        nextErrors.wifePhone = "Wife phone is required";
      }
    }

    if (form.visitType === "family") {
      if (!form.memberName.trim()) {
        nextErrors.memberName = "Member name is required";
      }
      if (!form.memberPhone.trim()) {
        nextErrors.memberPhone = "Member phone is required";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !validate()) return;
    try {
      setSubmitting(true);
      const additionalMembers: { name: string; phone: string; relation: string }[] =
        [];

      if (form.visitType === "wife") {
        additionalMembers.push({
          name: form.wifeName.trim(),
          phone: form.wifePhone.trim(),
          relation: "wife",
        });
      }

      if (form.visitType === "family") {
        additionalMembers.push({
          name: form.memberName.trim(),
          phone: form.memberPhone.trim(),
          relation: "member",
        });
      }

      const userRef = await addDoc(collection(db, "users"), {
        sessionId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        visitType: form.visitType,
        additionalMembers,
        createdAt: serverTimestamp(),
      });

      setRegisteredUserId(userRef.id);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          `qrchat_user_${sessionId}`,
          userRef.id,
        );
      }
    } catch (error) {
      console.error("Error registering user", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !registeredUserId || !message.trim()) return;

    try {
      setSendingMessage(true);
      await addDoc(collection(db, "messages"), {
        sessionId,
        userId: registeredUserId,
        message: message.trim(),
        timestamp: serverTimestamp(),
      });
      setMessage("");
    } catch (error) {
      console.error("Error sending message", error);
    } finally {
      setSendingMessage(false);
    }
  }

  if (sessionValid === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 p-6 text-center shadow-xl ring-1 ring-red-500/40">
          <h1 className="text-lg font-semibold text-red-200">
            Session not available
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            This QR session is no longer active. Please contact the admin for a
            new QR code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <main className="w-full max-w-md rounded-3xl bg-slate-900/80 p-6 shadow-2xl ring-1 ring-slate-800">
        <header className="mb-4">
          {sessionInfo?.imageUrl && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sessionInfo.imageUrl}
                alt={sessionInfo.name ?? "Seminar poster"}
                className="h-40 w-full object-cover"
              />
            </div>
          )}
          <h1 className="text-lg font-semibold tracking-tight text-slate-50">
            {sessionInfo?.name ?? "Welcome to QR Session"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Please complete your details once. After registration you&apos;ll be
            able to send a message to the organiser.
          </p>
        </header>

        {registeredUserId ? (
          <section>
            <p className="mb-3 text-xs text-emerald-300">
              You&apos;re registered for this session. You can now send
              messages to the admin.
            </p>
            <form onSubmit={handleSendMessage} className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                placeholder="Type your message here..."
              />
              <button
                type="submit"
                disabled={sendingMessage || !message.trim()}
                className="mt-1 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingMessage ? "Sending..." : "Send Message"}
              </button>
            </form>
          </section>
        ) : (
          <section>
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">
                  Full Name<span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter your full name"
                  disabled={isFormDisabled}
                />
                {errors.name && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-300">
                    Phone Number<span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="Your phone number"
                    disabled={isFormDisabled}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-[11px] text-red-400">
                      {errors.phone}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">
                    Email<span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="you@example.com"
                    disabled={isFormDisabled}
                  />
                  {errors.email && (
                    <p className="mt-1 text-[11px] text-red-400">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">
                  Visit Type<span className="text-red-400">*</span>
                </label>
                <select
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  value={form.visitType}
                  onChange={(e) =>
                    handleChange("visitType", e.target.value as VisitType)
                  }
                  disabled={isFormDisabled}
                >
                  <option value="self">Self</option>
                  <option value="wife">With Wife</option>
                  <option value="family">With Friend &amp; Family</option>
                </select>
              </div>

              {requiresWifeFields && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-300">
                      Wife Name<span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                      value={form.wifeName}
                      onChange={(e) =>
                        handleChange("wifeName", e.target.value)
                      }
                      placeholder="Enter wife name"
                      disabled={isFormDisabled}
                    />
                    {errors.wifeName && (
                      <p className="mt-1 text-[11px] text-red-400">
                        {errors.wifeName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">
                      Wife Phone<span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                      value={form.wifePhone}
                      onChange={(e) =>
                        handleChange("wifePhone", e.target.value)
                      }
                      placeholder="Wife phone number"
                      disabled={isFormDisabled}
                    />
                    {errors.wifePhone && (
                      <p className="mt-1 text-[11px] text-red-400">
                        {errors.wifePhone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {requiresMemberFields && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-300">
                      Member Name<span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                      value={form.memberName}
                      onChange={(e) =>
                        handleChange("memberName", e.target.value)
                      }
                      placeholder="Enter member name"
                      disabled={isFormDisabled}
                    />
                    {errors.memberName && (
                      <p className="mt-1 text-[11px] text-red-400">
                        {errors.memberName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300">
                      Member Phone<span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 outline-none ring-0 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                      value={form.memberPhone}
                      onChange={(e) =>
                        handleChange("memberPhone", e.target.value)
                      }
                      placeholder="Member phone number"
                      disabled={isFormDisabled}
                    />
                    {errors.memberPhone && (
                      <p className="mt-1 text-[11px] text-red-400">
                        {errors.memberPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isFormDisabled}
                className="mt-1 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Registering..." : "Complete Registration"}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

