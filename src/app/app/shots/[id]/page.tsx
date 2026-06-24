import Link from "next/link";
import { ResultView } from "@/components/ResultView";

export const metadata = { title: "Your shoot. Oviya Studio." };

export default async function ShotResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <Link href="/app/shots" className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>← My Shots</Link>
      <div style={{ marginTop: 16 }}>
        <ResultView id={id} />
      </div>
    </div>
  );
}
