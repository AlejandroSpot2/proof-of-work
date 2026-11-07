"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttorneyView, Entrust, PortfolioView, Snapshot } from "@/lib/views/project";
import type { Opportunity } from "@/lib/opportunities";
import type { NextStep } from "@/lib/next-steps";
import type { ExampleCorrection } from "../CorrectionDialog";

export type ExampleInfo = {
  disclaimer: string;
  goal: string;
  role: string;
  bio: string;
  cv: string;
  projects: { title: string; role: string; url: string; summary?: string }[];
  correction: ExampleCorrection;
};

export type WorkspaceState = {
  snapshot: Snapshot;
  entrust: Entrust;
  portfolio: PortfolioView;
  attorney: AttorneyView;
  opportunities: Opportunity[];
  nextSteps: NextStep[];
  example: ExampleInfo | null;
};

export type LiveSource = { projectId: string; url: string; locator: string; status: string; statusDetail: string };

export async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export function useWorkspace(home = "/demo") {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<{ titles: Record<string, string>; sources: LiveSource[] } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = `/api/example/start?to=${encodeURIComponent(home)}`;
      return;
    }
    setState((await res.json()) as WorkspaceState);
  }, [home]);

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, [refresh]);

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      setBusy(label);
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  /** Runs the real import and shows each file as the server reports it. Nothing here is simulated. */
  const readProjects = useCallback(
    (projects: { title: string; role: string; url: string }[]) =>
      run("import", async () => {
        setReading({ titles: {}, sources: [] });
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projects: projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] })) }),
        });
        if (!res.ok || !res.body) throw new Error("Could not read the projects");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const e = JSON.parse(line);
            if (e.type === "project") setReading((r) => r && { ...r, titles: { ...r.titles, [e.projectId]: e.title } });
            if (e.type === "source") setReading((r) => r && { ...r, sources: [...r.sources, e] });
            if (e.type === "error") throw new Error(e.message);
          }
        }
      }),
    [run],
  );

  return { state, busy, error, setError, run, refresh, readProjects, reading };
}
