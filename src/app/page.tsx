import { getUser } from "@/lib/supabase/server";
import { LandingExperience } from "@/components/landing/LandingExperience";

export const metadata = {
  title: "Oviya Studio. Your product. Your model. Your shoot.",
  description: "Every product, a work of art. Turn your product into a high-fashion editorial shoot.",
  openGraph: { title: "Oviya Studio", description: "Every product, a work of art.", images: ["/v4/hero/hero-wide.png"], type: "website" },
};

// Session-aware: the experience renders "Enter the Studio" for signed-in houses, "Start your shoot"
// otherwise. (/login and /signup redirect to the studio when already authed.)
export default async function Home() {
  const user = await getUser();
  return <LandingExperience authed={!!user} />;
}
