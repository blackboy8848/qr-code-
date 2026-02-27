import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <main className="w-full max-w-2xl rounded-3xl bg-slate-900/80 p-8 text-slate-50 shadow-2xl ring-1 ring-slate-800">
        <div className="flex items-center gap-3">
          <Image
            src="/SyneMerge-Logo-og-1.png"
            alt="Synemerge logo"
            width={160}
            height={32}
            className="h-8 w-auto"
            priority
          />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Synemerge QR Session Chat
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Synemerge can create QR-based seminar sessions and monitor incoming
          visitor messages in
          real-time. Visitors scan a QR code, register once, and then send
          simple one-way chat messages to the admin dashboard.
        </p>
        <div className="mt-6 grid gap-4 text-sm text-slate-200 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-slate-800/70">
            <h2 className="text-sm font-semibold text-slate-50">
              Admin Flow
            </h2>
            <ol className="mt-2 space-y-1 text-xs text-slate-300">
              <li>1. Open the admin panel.</li>
              <li>2. Create a new session.</li>
              <li>3. QR code is generated.</li>
              <li>4. Watch messages in real-time.</li>
            </ol>
            <a
              href="/admin"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400"
            >
              Go to Admin Panel
            </a>
          </div>
          <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-slate-800/70">
            <h2 className="text-sm font-semibold text-slate-50">
              Visitor Flow
            </h2>
            <ol className="mt-2 space-y-1 text-xs text-slate-300">
              <li>1. Scan QR code.</li>
              <li>2. Fill registration form.</li>
              <li>3. Registration form hides.</li>
              <li>4. Send messages via a single input box.</li>
            </ol>
            <p className="mt-4 text-[11px] text-slate-400">
              The session URL looks like <code>/session/&lt;sessionId&gt;</code>{" "}
              and is encoded inside the QR code.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
