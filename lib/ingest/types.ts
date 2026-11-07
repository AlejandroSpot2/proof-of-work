export type SourceKind = "github" | "web" | "user" | "fixture";

/** all-by-handle: every line was written by the person. line-prefix: lines read "<sha> <author>: <message>". */
export type Authorship = "all-by-handle" | "line-prefix";
export type SourceStatus = "ok" | "unavailable" | "blocked";

export type GithubMeta = {
  owner: string;
  repo: string;
  handle: string;
  handleIsOwner: boolean;
  handleCommitCount: number;
  totalCommitsSampled: number;
  languages?: Record<string, number>;
};

export type FetchedSource = {
  url: string;
  kind: SourceKind;
  status: SourceStatus;
  statusDetail: string;
  locator: string;
  text: string;
  meta?: GithubMeta;
  authorship?: Authorship;
};
