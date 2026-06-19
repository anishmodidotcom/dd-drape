import { Studio } from "@/components/Studio";
import { listModels } from "@/lib/models/data";

export const metadata = { title: "On Set. Oviya Studio." };

export default async function NewShotPage() {
  const models = await listModels();
  const savedModels = models
    .filter((m) => m.status === "ready" && m.image_paths?.length)
    .map((m) => ({ id: m.id, name: m.name, image_paths: m.image_paths }));

  return <Studio savedModels={savedModels} />;
}
