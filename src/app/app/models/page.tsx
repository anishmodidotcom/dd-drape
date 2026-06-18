import { listModels } from "@/lib/models/data";
import { CreateModelPanel } from "@/components/CreateModelPanel";
import { SmartImage } from "@/components/SmartImage";

export const metadata = { title: "Models. Drape." };

export default async function ModelsPage() {
  const models = await listModels();

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <p className="eyebrow">Models studio</p>
        <h1 style={{ fontSize: 32 }}>Your models</h1>
        <p className="muted" style={{ maxWidth: "52ch" }}>
          Create a model once, then reuse the same face and body across your whole catalog.
        </p>
      </div>

      <div style={{ margin: "20px 0" }}>
        <CreateModelPanel />
      </div>

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
