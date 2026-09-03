import { getAllModels } from "@/lib/server/database";
import { HomePageClient } from "@/components/home/HomeClient";

const INITIAL_PAGE_SIZE = 20;

/**
 * Server-rendered homepage (RSC). The full catalog is fetched on the server
 * from the merged local + Supabase data layer — no client fetch, no CORS,
 * no skeleton flash. Only the first page of results and precomputed category
 * counts are sent to the client to minimize payload.
 */
export default async function HomePage() {
  let allModels: Awaited<ReturnType<typeof getAllModels>> = [];
  try {
    allModels = await getAllModels();
  } catch {
    // Degrade to an empty catalog — the client UI still renders and search
    // (which hits the API directly) keeps working.
    allModels = [];
  }

  // Precompute category counts on the server so the client never needs the
  // full catalog just to display the FilterBar.
  const categoryCounts: Record<string, number> = { all: allModels.length };
  for (const m of allModels) {
    categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
  }

  // Send only the first page to the client. The full catalog stays server-side;
  // additional pages are fetched via /api/computers on "Load More" or category switch.
  const initialModels = allModels.slice(0, INITIAL_PAGE_SIZE);

  return (
    <HomePageClient
      initialModels={initialModels}
      categoryCounts={categoryCounts}
      initialTotal={allModels.length}
    />
  );
}
