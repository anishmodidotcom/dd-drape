import { Suspense } from "react";
import { getJobs } from "@/lib/data";
import { VideoStudio } from "@/components/video/VideoStudio";

export const metadata = { title: "Video. Oviya Studio." };

export default async function VideoPage() {
  const jobs = await getJobs(60);
  const shots = jobs
    .filter((j) => j.status === "done" && j.result_ref && !String(j.type).startsWith("video/") && !String(j.type).startsWith("model/"))
    .map((j) => ({ id: j.id, result_ref: j.result_ref }));
  return (
    <div className="page">
      <Suspense fallback={null}>
        <VideoStudio shots={shots} />
      </Suspense>
    </div>
  );
}
