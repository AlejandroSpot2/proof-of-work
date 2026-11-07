"use client";

import { useState } from "react";
import s from "./landing.module.css";

async function start(body: unknown) {
  const res = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not start");
  window.location.href = "/studio";
}

export function StartExample() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={s.start}>
      <button
        className="btn"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          start({ mode: "fixture" }).catch((e) => {
            setError(e.message);
            setBusy(false);
          });
        }}
      >
        {busy ? "Opening" : "Open the EXAMPLE workspace"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function StartLive() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={s.liveForm}
      onSubmit={(e) => {
        e.preventDefault();
        start({ mode: "live", personName: name, githubHandle: handle }).catch((err) => setError(err.message));
      }}
    >
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label>
        GitHub handle
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="octocat" autoComplete="username" />
      </label>
      <button className="btn btn-quiet" disabled={!name.trim() || !handle.trim()}>
        Start a private live workspace
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
