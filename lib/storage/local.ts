import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Computer } from "@/lib/data/types";

const FAVORITES_KEY = "gen_user_favorites";
const RECENT_KEY = "gen_user_recent";
const MAX_RECENT = 15;

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>(FAVORITES_KEY, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) =>
        prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
      );
    },
    [setFavorites]
  );

  const getFavoriteComputers = useCallback(
    (allComputers: Computer[]) => {
      return allComputers.filter((c) => favorites.includes(c.id));
    },
    [favorites]
  );

  return { favorites, isFavorite, toggleFavorite, getFavoriteComputers };
}

export function useRecentComputers() {
  const [recent, setRecent] = useLocalStorage<string[]>(RECENT_KEY, []);

  const addRecent = useCallback(
    (id: string) => {
      setRecent((prev) => {
        const filtered = prev.filter((r) => r !== id);
        return [id, ...filtered].slice(0, MAX_RECENT);
      });
    },
    [setRecent]
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
  }, [setRecent]);

  return { recent, addRecent, clearRecent };
}
