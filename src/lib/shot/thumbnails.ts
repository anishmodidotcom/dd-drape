// Wave 1 preset thumbnails. The manifest (written by scripts/gen-presets.mjs) maps option ids to
// paths in the public drape-presets bucket. thumbUrl returns a public URL when a thumbnail exists,
// else null so the UI falls back to text.

import manifest from "./preset-thumbnails.json";

type Group = "presets" | "poses" | "lighting" | "sets" | "makeup" | "hair";

const m = manifest as Record<string, unknown>;

export function thumbUrl(group: Group, id: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const grp = m[group] as Record<string, string> | undefined;
  const path = grp?.[id];
  if (!path) return null;
  return `${base}/storage/v1/object/public/drape-presets/${path}`;
}

export function hasThumbnails(group: Group): boolean {
  const grp = m[group] as Record<string, string> | undefined;
  return !!grp && Object.keys(grp).length > 0;
}
