// Shared by the header search and the search route. No Zod: the field imports this file.

/** Characters typed before any results are requested or shown. */
export const SEARCH_MIN_LENGTH = 3;

/** Matches kept per group, so the dropdown stays a short list. */
export const SEARCH_GROUP_LIMIT = 5;

export type SearchHit = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

/** One labelled group in the dropdown ("Leads", "Tasks"). Which groups appear depends on the caller's role. */
export type SearchGroup = { key: string; label: string; hits: SearchHit[] };

export type SearchResults = { groups: SearchGroup[] };
