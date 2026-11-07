import { loadCv, loadProfile } from "@/lib/fixtures/rin";
import s from "@/components/present.module.css";

export const metadata = { title: "Flat CV (EXAMPLE) | Proof of Work" };

export default function CvPage() {
  const profile = loadProfile();
  const lines = loadCv().split("\n").filter((l) => l.trim());
  return (
    <main className={s.page}>
      <header className={`${s.bar} no-print`}>
        <span className={s.wordmark}>Proof of Work</span>
        <span className="small">The flat CV, the before. It is not evidence of itself. Print to save a PDF.</span>
      </header>
      <article className={s.sheet} style={{ fontFamily: "'Times New Roman', Times, serif", color: "#2b2a26", background: "#f7f7f5", padding: "48px" }}>
        <p className="example-flag" style={{ fontFamily: "Switzer, sans-serif" }}>EXAMPLE</p>
        {lines.map((l, i) =>
          l.startsWith("# ") ? (
            <h1 key={i} style={{ fontFamily: "inherit", fontSize: "2rem", letterSpacing: 0, margin: "16px 0 8px", color: "inherit" }}>{l.slice(2)}</h1>
          ) : l.startsWith("## ") ? (
            <h2 key={i} style={{ fontFamily: "inherit", fontSize: "1.25rem", letterSpacing: 0, margin: "20px 0 6px", color: "inherit" }}>{l.slice(3)}</h2>
          ) : (
            <p key={i} style={{ margin: "4px 0" }}>{l.replace(/^- /, "")}</p>
          ),
        )}
        <p className="small" style={{ marginTop: 32, fontFamily: "Switzer, sans-serif" }}>{profile.disclaimer}</p>
      </article>
    </main>
  );
}
