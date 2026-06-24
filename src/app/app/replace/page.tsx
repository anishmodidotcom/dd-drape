import { Suspense } from "react";
import { getJobs } from "@/lib/data";
import { ReplacePanel } from "@/components/replace/ReplacePanel";

export const metadata = { title: "Replace. Oviya Studio." };

export default async function ReplacePage() {
  const jobs = await getJobs(60);
  const shots = jobs
    .filter((j) => j.status === "done" && j.result_ref && !String(j.type).startsWith("video/") && !String(j.type).startsWith("model/"))
    .map((j) => ({ id: j.id, result_ref: j.result_ref }));
  return (
    <div className="page">
      <Suspense fallback={null}>
        <ReplacePanel shots={shots} />
      </Suspense>
    </div>
  );
}
