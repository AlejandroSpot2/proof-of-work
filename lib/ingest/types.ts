export type SourceKind = "github" | "web" | "user";
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
};
