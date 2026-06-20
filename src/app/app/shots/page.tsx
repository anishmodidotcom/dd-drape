import { getJobs } from "@/lib/data";
import { ShotsGallery } from "@/components/shots/ShotsGallery";
import type { Tier } from "@/lib/engine/tier";

export const metadata = { title: "My Shots. Oviya Studio." };

export default async function MyShotsPage() {
  const jobs = await getJobs(120);
  // Only product shots in the lookbook (model-creation jobs are not shots).
  const shots = jobs
    .filter((j) => !String(j.type).startsWith("model/"))
    .map((j) => ({
      id: j.id,
      result_ref: j.result_ref,
      type: j.type,
      status: j.status,
      tier: (j.tier as Tier | null) ?? null,
      created_at: j.created_at,
    }));
  return (
    <div className="page">
      <ShotsGallery shots={shots} />
    </div>
  );
}
