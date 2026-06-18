import Link from "next/link";
import { getJobs } from "@/lib/data";
import { SmartImage } from "@/components/SmartImage";
import { TierBadge } from "@/components/TierBadge";
import type { Tier } from "@/lib/engine/tier";

export const metadata = { title: "My shots. Drape." };

export default async function MyShotsPage() {
  const jobs = await getJobs(60);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 32 }}>My shots</h1>
        <Link href="/app/new" className="btn btn-primary">New shot</Link>
      </div>

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>No shots yet</p>
          <p className="muted" style={{ marginBottom: 16 }}>
            Upload a product and generate your first shot.
          </p>
          <Link href="/app/new" className="btn btn-primary">Start a shot</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
          {jobs.map((j) => (
            <Link key={j.id} href={`/app/shots/${j.id}`} className="tile" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ aspectRatio: "3 / 4", background: "var(--ink)" }}>
                {j.result_ref ? (
                  <SmartImage
                    path={j.result_ref}
                    alt="shot"
                    isVideo={j.type.startsWith("video/")}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
                    <span className="muted" style={{ fontSize: 13, color: "var(--fog)" }}>
                      {j.status === "failed" ? "Failed" : "Processing"}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12 }} className="muted">
                  {j.type.startsWith("video/") ? "Video" : "Image"}
                </span>
                {/* MN1: only flag review-needed (amber/red), not every card. */}
                {j.tier && j.tier !== "green" && j.status === "done" && <TierBadge tier={j.tier as Tier} />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
