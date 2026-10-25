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

export type SearchResults = {
  leads: SearchHit[];
  clients: SearchHit[];
  staff: SearchHit[];
};
