import Link from "next/link";
import { getJobs } from "@/lib/data";
import { signedUrl } from "@/lib/engine/storage";
import { TierBadge } from "@/components/TierBadge";
import type { Tier } from "@/lib/engine/tier";

export const metadata = { title: "My shots. Drape." };

export default async function MyShotsPage() {
  const jobs = await getJobs(60);
  const cards = await Promise.all(
    jobs.map(async (j) => ({
      id: j.id,
      status: j.status,
      type: j.type,
      tier: j.tier as Tier | null,
      thumb: j.result_ref ? await signedUrl(j.result_ref).catch(() => null) : null,
    }))
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 32 }}>My shots</h1>
        <Link href="/app/new" className="btn btn-primary">New shot</Link>
      </div>

      {cards.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>No shots yet</p>
          <p className="muted" style={{ marginBottom: 16 }}>
            Upload a product and generate your first shot.
          </p>
          <Link href="/app/new" className="btn btn-primary">Start a shot</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
          {cards.map((c) => (
            <Link key={c.id} href={`/app/shots/${c.id}`} className="tile" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ aspectRatio: "3 / 4", background: "var(--ink)", display: "grid", placeItems: "center" }}>
                {c.thumb ? (
                  c.type.startsWith("video/") ? (
                    <video src={c.thumb} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumb} alt="shot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )
                ) : (
                  <span className="muted" style={{ fontSize: 13, color: "var(--fog)" }}>
                    {c.status === "failed" ? "Failed" : "Processing"}
                  </span>
                )}
              </div>
              <div style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12 }} className="muted">
                  {c.type.startsWith("video/") ? "Video" : "Image"}
                </span>
                {c.tier && <TierBadge tier={c.tier} />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
