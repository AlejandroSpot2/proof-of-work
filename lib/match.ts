const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A stem matches at the start of a word: "merg" finds "merges", never "emerge". */
export const mentions = (text: string, stems: string[]) => stems.some((m) => new RegExp(`\\b${escapeRegExp(m)}`, "i").test(text));
