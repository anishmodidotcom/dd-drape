import { ResultView } from "@/components/ResultView";

export const metadata = { title: "Your shoot. Oviya Studio." };

export default async function ShotResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <p className="eyebrow" style={{ marginBottom: 16 }}>
        Result
      </p>
      <ResultView id={id} />
    </>
  );
}
