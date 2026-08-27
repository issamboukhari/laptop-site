import { getAllModels } from "@/lib/server/database";
import { HomePageClient } from "@/components/home/HomeClient";

/**
 * Server-rendered homepage (RSC). The full catalog is fetched on the server
 * from the merged local + Supabase data layer — no client fetch, no CORS,
 * no skeleton flash. The interactive shell is a client island below.
 */
export default async function HomePage() {
  let initialModels: Awaited<ReturnType<typeof getAllModels>> = [];
  try {
    initialModels = await getAllModels();
  } catch {
    // Degrade to an empty catalog — the client UI still renders and search
    // (which hits the API directly) keeps working.
    initialModels = [];
  }

  return <HomePageClient initialModels={initialModels} />;
}
