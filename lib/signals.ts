export type SignalType = "current_posting_states_sponsorship" | "historical_filings" | "unknown";

export type EmployerRecord = {
  id: string;
  company: string;
  entityName: string | null;
  location: string | null;
  role: string;
  snippet: string | null;
  retrieved: string | null;
  signalType: SignalType;
  status: string | null;
  matches: string[];
};

export const SIGNAL_COPY: Record<SignalType, { label: string; caveat: string }> = {
  current_posting_states_sponsorship: {
    label: "The current posting says it sponsors visas",
    caveat: "One role's sponsorship is not every visa type, and a posting can change.",
  },
  historical_filings: {
    label: "Past filings only",
    caveat: "Historical filings are not current policy. Nothing here says this role sponsors today.",
  },
  unknown: { label: "Unknown", caveat: "No source states a sponsorship position. Not guessed." },
};

export const OPPORTUNITY_NOTICE = "Not legal advice. Fictional EXAMPLE employers. No job or visa outcome is implied.";
