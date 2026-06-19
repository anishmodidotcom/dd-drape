import { listModels } from "@/lib/models/data";
import { CreateModelPanel } from "@/components/CreateModelPanel";
import { SmartImage } from "@/components/SmartImage";
import { MODEL_ANGLES, MODEL_CREATE_CREDITS } from "@/lib/models/schema";

export const metadata = { title: "Your Muses. Oviya Studio." };

export default async function ModelsPage() {
  const models = await listModels();

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <p className="eyebrow">Casting board</p>
        <h1 style={{ fontSize: 32 }}>Your muses</h1>
        <p className="muted" style={{ maxWidth: "52ch" }}>
          Cast a muse once, then reuse the same face and body across your whole catalog.
        </p>
      </div>

      <div style={{ margin: "20px 0" }}>
        <CreateModelPanel />
      </div>

      {models.length === 0 && (
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>What you get</strong>
            <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>
              Each model is {MODEL_CREATE_CREDITS} credits and produces four consistent white-background
              reference shots, so the same person can wear every product in your catalog.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, maxWidth: 460 }}>
            {MODEL_ANGLES.map((a) => (
              <div key={a.id} style={{ textAlign: "center" }}>
                <div className="skeleton" style={{ aspectRatio: "3/4", borderRadius: 10, marginBottom: 6 }} />
                <span className="muted" style={{ fontSize: 11 }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {models.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          {models.map((m) => (
            <div key={m.id} className="tile" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ aspectRatio: "3 / 4", background: "var(--ink)" }}>
                {m.image_paths?.[0] && (
                  <SmartImage
                    path={m.image_paths[0]}
                    alt={m.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, fontFamily: "var(--font-display)" }}>{m.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{m.image_paths?.length ?? 0} angles</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
