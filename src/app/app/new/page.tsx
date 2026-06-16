import { NewShotWizard } from "@/components/NewShotWizard";

export const metadata = { title: "New shot. Drape." };

export default function NewShotPage() {
  return (
    <>
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        New shot
      </p>
      <NewShotWizard />
    </>
  );
}
