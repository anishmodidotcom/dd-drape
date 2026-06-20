import { listModels } from "@/lib/models/data";
import { ModelsGallery } from "@/components/models/ModelsGallery";

export const metadata = { title: "Your Models. Oviya Studio." };

export default async function ModelsPage() {
  const models = await listModels();
  const cards = models.map((m) => ({ id: m.id, name: m.name, image_paths: m.image_paths ?? [] }));
  return (
    <div className="page">
      <ModelsGallery models={cards} />
    </div>
  );
}
