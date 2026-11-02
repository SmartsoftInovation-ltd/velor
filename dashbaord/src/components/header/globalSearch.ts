import type { SidebarSection } from "../../layout/sidebarNav";
import type { ReportCategory } from "../reports/reportCategories";

export type SearchEntry = {
  name: string;
  path: string;
  // Where the page lives, e.g. "Sales Purchase › Product"
  trail: string;
  description?: string;
};

export const MAX_RESULTS = 12;

const joinTrail = (...parts: string[]) => parts.filter(Boolean).join(" › ");

export const buildSearchEntries = (
  sections: SidebarSection[],
  reports: ReportCategory[],
): SearchEntry[] => {
  const entries: SearchEntry[] = [];
  const add = (entry: SearchEntry) => {
    // A menu can link the same page twice; it should be listed once
    if (!entries.some((e) => e.path === entry.path)) entries.push(entry);
  };

  sections.forEach(({ label, items }) =>
    items.forEach((nav) => {
      const name = nav.name.trim();
      if (nav.path) add({ name, path: nav.path, trail: label });
      nav.subItems?.forEach((sub) => {
        if (sub.path) add({ name: sub.name, path: sub.path, trail: joinTrail(label, name) });
        sub.subSubItems?.forEach((leaf) =>
          add({ name: leaf.name, path: leaf.path, trail: joinTrail(label, name, sub.name) }),
        );
      });
    }),
  );

  reports.forEach(({ label, reports: list }) =>
    list.forEach((r) =>
      add({ name: r.name, path: r.path, trail: joinTrail("Reports", label), description: r.description }),
    ),
  );

  return entries;
};

// Lower is better; null when a word of the query is found nowhere
const rank = (entry: SearchEntry, query: string, words: string[]): number | null => {
  const name = entry.name.toLowerCase();
  const haystack = `${name} ${entry.trail.toLowerCase()} ${(entry.description ?? "").toLowerCase()}`;
  if (!words.every((w) => haystack.includes(w))) return null;

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/\s+/).some((part) => part.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  if (words.every((w) => name.includes(w))) return 4;
  const nameAndTrail = `${name} ${entry.trail.toLowerCase()}`;
  return words.every((w) => nameAndTrail.includes(w)) ? 5 : 6;
};

export const searchEntries = (entries: SearchEntry[], rawQuery: string): SearchEntry[] => {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (!query) return [];
  const words = query.split(" ");

  return entries
    .map((entry) => ({ entry, score: rank(entry, query, words) }))
    .filter((r): r is { entry: SearchEntry; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, MAX_RESULTS)
    .map((r) => r.entry);
};
