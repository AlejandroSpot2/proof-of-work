import type { FetchedSource, GithubMeta } from "@/lib/ingest/types";
import type { Attribution, ClaimKind } from "@/lib/domain/types";

/**
 * EXAMPLE data. Jordan Vale is a hypothetical person; every repository, page and number below is invented
 * for the no-keys demo and says nothing about any real person's skills.
 */
export const EXAMPLE_PERSON = {
  personName: "Jordan Vale",
  githubHandle: "jordanvale-example",
};

export const EXAMPLE_GOAL = "Own the offline sync layer for our field-service mobile app";
export const EXAMPLE_UNSUPPORTED_GOAL = "Lead our FPGA firmware team";

export type ExampleProjectInput = { title: string; role: string; urls: { url: string; ownPage?: boolean }[] };

export const EXAMPLE_PROJECTS: ExampleProjectInput[] = [
  {
    title: "tidepool-sync",
    role: "Maintainer",
    urls: [{ url: "https://github.com/jordanvale-example/tidepool-sync" }],
  },
  {
    title: "Harbor UI token migration",
    role: "Contractor",
    urls: [
      { url: "https://github.com/harbor-labs-example/harbor-ui" },
      { url: "https://jordanvale.example/notes/harbor-tokens", ownPage: true },
    ],
  },
  {
    title: "ledgerline WAL fix",
    role: "Open-source contributor",
    urls: [
      { url: "https://github.com/ledgerline-example/ledgerline" },
      { url: "https://ledgerline.example/releases/v2.4" },
    ],
  },
];

const H = EXAMPLE_PERSON.githubHandle;

function gh(
  owner: string,
  repo: string,
  commits: number,
  sampled: number,
  languages: Record<string, number>,
  parts: { repository: string; readme: string; languages: string; contributors: string; commits: string },
): FetchedSource[] {
  const meta: GithubMeta = {
    owner,
    repo,
    handle: H,
    handleIsOwner: owner.toLowerCase() === H,
    handleCommitCount: commits,
    totalCommitsSampled: sampled,
    languages,
  };
  const base = `https://github.com/${owner}/${repo}`;
  const ok = (url: string, locator: string, text: string): FetchedSource => ({
    url,
    kind: "github",
    status: "ok",
    statusDetail: "EXAMPLE fixture (no network)",
    locator,
    text,
    meta,
  });
  return [
    ok(base, "repository", parts.repository),
    ok(`${base}#readme`, "README", parts.readme),
    ok(`${base}/graphs/contributors`, "contributors", parts.contributors),
    ok(`${base}/commits?author=${H}`, `commits by @${H}`, parts.commits),
    ok(`${base}/languages`, "languages", parts.languages),
  ];
}

const FIXTURE_SOURCES: Record<string, FetchedSource[]> = {
  "https://github.com/jordanvale-example/tidepool-sync": gh(
    "jordanvale-example",
    "tidepool-sync",
    188,
    229,
    { Kotlin: 48.2, TypeScript: 39.5, Shell: 12.3 },
    {
      repository: [
        "Repository: jordanvale-example/tidepool-sync",
        "Description: Offline-first sync engine for field-notes apps. Works without signal, merges when back online.",
        "Owner: jordanvale-example",
        "Default branch: main",
        "Created: 2025-02-11",
        "Last push: 2026-10-30",
      ].join("\n"),
      readme: [
        "tidepool-sync",
        "Offline-first sync for apps that are used where the signal is not.",
        "How it works",
        "Every write is stored locally first and stamped with a hybrid logical clock.",
        "Conflict resolution uses per-field last-writer-wins, ordered by hybrid logical clock timestamps, so two edits to different fields of the same note both survive.",
        "Deletes are tombstones kept for 30 days so a device that was offline for weeks still converges.",
        "Results",
        "Switching the wire format to delta encoding cut the median sync payload from 41 KB to 15 KB in our field test with 12 devices.",
      ].join("\n"),
      languages: "Kotlin: 48.2% of bytes\nTypeScript: 39.5% of bytes\nShell: 12.3% of bytes",
      contributors: "jordanvale-example: 188 commits\nmina-kim-example: 41 commits",
      commits: [
        "a91c3e2 Add hybrid logical clock to every local write",
        "5be0d17 Per-field LWW merge for note documents",
        "c0f4a88 Switch wire format to delta encoding",
        "7d2e9b1 Keep tombstones 30 days for long-offline devices",
        "e13aa70 Android: background sync worker with exponential backoff",
      ].join("\n"),
    },
  ),
  "https://github.com/harbor-labs-example/harbor-ui": gh(
    "harbor-labs-example",
    "harbor-ui",
    0,
    620,
    { TypeScript: 71.0, CSS: 29.0 },
    {
      repository: [
        "Repository: harbor-labs-example/harbor-ui",
        "Description: Harbor's React component library and design tokens.",
        "Owner: harbor-labs-example",
        "Default branch: main",
      ].join("\n"),
      readme: "Harbor UI\nComponents and tokens for Harbor products.\nMaintained by the Harbor design-systems team.",
      languages: "TypeScript: 71.0% of bytes\nCSS: 29.0% of bytes",
      contributors: "p-alvarez-example: 402 commits\nsam-oduya-example: 218 commits",
      commits: `No commits by @${H} in the sampled history.`,
    },
  ),
  "https://jordanvale.example/notes/harbor-tokens": [
    {
      url: "https://jordanvale.example/notes/harbor-tokens",
      kind: "user",
      status: "ok",
      statusDetail: "EXAMPLE fixture (no network)",
      locator: "page",
      text: [
        "Notes: moving Harbor to design tokens",
        "In 2025 I led the token migration for Harbor UI: we replaced 1,400 hard-coded colors with 96 semantic tokens.",
        "I ran the audit, wrote the migration codemod, and paired with the design-systems team on review.",
        "This note is my own account; the repository is maintained by Harbor.",
      ].join("\n"),
    },
  ],
  "https://github.com/ledgerline-example/ledgerline": gh(
    "ledgerline-example",
    "ledgerline",
    14,
    1390,
    { Rust: 92.4, Python: 7.6 },
    {
      repository: [
        "Repository: ledgerline-example/ledgerline",
        "Description: Embedded append-only ledger store with a write-ahead log.",
        "Owner: ledgerline-example",
        "Default branch: main",
      ].join("\n"),
      readme:
        "ledgerline\nAn embedded, append-only ledger store. Writes go to a write-ahead log (WAL) and are checkpointed into immutable segments.",
      languages: "Rust: 92.4% of bytes\nPython: 7.6% of bytes",
      contributors: "ana-reyes-example: 1312 commits\njordanvale-example: 14 commits\ntheo-lund-example: 64 commits",
      commits: [
        "f3b8a21 Fix race between WAL checkpoint and concurrent append (#412)",
        "09d1c7e Add regression test for checkpoint/append interleaving (#412)",
        "b7e4410 Document checkpoint locking order",
      ].join("\n"),
    },
  ),
  "https://ledgerline.example/releases/v2.4": [
    {
      url: "https://ledgerline.example/releases/v2.4",
      kind: "web",
      status: "ok",
      statusDetail: "EXAMPLE fixture (no network)",
      locator: "page",
      text: [
        "ledgerline v2.4 release notes",
        "Fixed: a race between WAL checkpointing and concurrent appends that could drop the last write after a crash (#412).",
        `Thanks to @${H} for the fix and the regression test.`,
      ].join("\n"),
    },
  ],
};

export function fixtureSourcesFor(url: string, ownPage: boolean): FetchedSource[] {
  const found = FIXTURE_SOURCES[url];
  if (!found) {
    return [
      {
        url,
        kind: ownPage ? "user" : "web",
        status: "unavailable",
        statusDetail: "Not in the EXAMPLE fixture set. Fixture mode makes no network calls.",
        locator: "page",
        text: "",
      },
    ];
  }
  return found.map((s) => ({ ...s }));
}

export type FixtureClaim = {
  text: string;
  kind: ClaimKind;
  attribution: Attribution;
  tags: string[];
  legalFlag: string | null;
  quotes: { url: string; locator: string; quote: string }[];
};

const TP = "https://github.com/jordanvale-example/tidepool-sync";
const LL = "https://github.com/ledgerline-example/ledgerline";

/** What a model might plausibly propose, including one over-attribution and one fabricated quote, so the guards have work to do. */
export const FIXTURE_PROPOSALS: Record<string, { claims: FixtureClaim[]; questions: string[] }> = {
  "tidepool-sync": {
    claims: [
      {
        text: "Designed and built tidepool-sync's per-field conflict resolution",
        kind: "contribution",
        attribution: "author",
        tags: ["sync", "conflict-resolution", "offline"],
        legalFlag: null,
        quotes: [
          {
            url: `${TP}#readme`,
            locator: "README",
            quote:
              "Conflict resolution uses per-field last-writer-wins, ordered by hybrid logical clock timestamps, so two edits to different fields of the same note both survive.",
          },
          { url: `${TP}/commits?author=${H}`, locator: `commits by @${H}`, quote: "5be0d17 Per-field LWW merge for note documents" },
        ],
      },
      {
        text: "Cut the median sync payload from 41 KB to 15 KB by moving to delta encoding",
        kind: "impact",
        attribution: "author",
        tags: ["sync", "performance"],
        legalFlag: null,
        quotes: [
          {
            url: `${TP}#readme`,
            locator: "README",
            quote:
              "Switching the wire format to delta encoding cut the median sync payload from 41 KB to 15 KB in our field test with 12 devices.",
          },
          { url: `${TP}/commits?author=${H}`, locator: `commits by @${H}`, quote: "c0f4a88 Switch wire format to delta encoding" },
        ],
      },
      {
        text: "Writes Kotlin for Android clients",
        kind: "skill",
        attribution: "author",
        tags: ["kotlin", "android", "mobile"],
        legalFlag: null,
        quotes: [{ url: `${TP}/languages`, locator: "languages", quote: "Kotlin: 48.2% of bytes" }],
      },
    ],
    questions: ["Was tidepool-sync used by anyone outside the 12-device field test?"],
  },
  "Harbor UI token migration": {
    claims: [
      {
        text: "Built the Harbor UI component library",
        kind: "contribution",
        attribution: "author",
        tags: ["frontend", "design-systems"],
        legalFlag: null,
        quotes: [
          {
            url: "https://github.com/harbor-labs-example/harbor-ui#readme",
            locator: "README",
            quote: "Components and tokens for Harbor products.",
          },
        ],
      },
      {
        text: "Led Harbor UI's migration from hard-coded colors to semantic design tokens",
        kind: "contribution",
        attribution: "author",
        tags: ["design-systems", "frontend", "codemods"],
        legalFlag: null,
        quotes: [
          {
            url: "https://jordanvale.example/notes/harbor-tokens",
            locator: "page",
            quote: "In 2025 I led the token migration for Harbor UI: we replaced 1,400 hard-coded colors with 96 semantic tokens.",
          },
        ],
      },
    ],
    questions: ["Can you link the migration codemod or a pull request in Harbor's repository?"],
  },
  "ledgerline WAL fix": {
    claims: [
      {
        text: "Fixed a race between WAL checkpointing and concurrent appends in ledgerline",
        kind: "contribution",
        attribution: "contributor",
        tags: ["storage", "concurrency", "rust", "sync"],
        legalFlag:
          "Possible original contribution to an open-source project. Whether it is of major significance is a legal judgment for an attorney.",
        quotes: [
          {
            url: `${LL}/commits?author=${H}`,
            locator: `commits by @${H}`,
            quote: "f3b8a21 Fix race between WAL checkpoint and concurrent append (#412)",
          },
          {
            url: "https://ledgerline.example/releases/v2.4",
            locator: "page",
            quote: `Thanks to @${H} for the fix and the regression test.`,
          },
        ],
      },
      {
        text: "Maintains ledgerline's storage engine",
        kind: "contribution",
        attribution: "author",
        tags: ["storage", "rust"],
        legalFlag: null,
        quotes: [{ url: `${LL}#readme`, locator: "README", quote: "Jordan Vale maintains the storage engine." }],
      },
    ],
    questions: [],
  },
};

/** The correction the demo makes: the README never says who designed the merge rule; the builder knows it was shared. */
export const EXAMPLE_CORRECTION = {
  claimText: "Designed and built tidepool-sync's per-field conflict resolution",
  attribution: "co_author" as const,
  note: "Merge rule co-designed with Mina Kim; I built the Android client and the clock.",
};
