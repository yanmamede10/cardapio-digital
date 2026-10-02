import { useEffect } from "react";
import { api } from "./api";

// One name lookup per restaurant per page load: every screen's tab title ends in it.
const names = new Map<string, Promise<string>>();

/** The browser tab's title: "<screen> · <restaurant>" (checklist 5), or "<screen> · Cardápio Digital" with no restaurant yet. */
export function usePageTitle(screen: string, restaurantId?: string | null) {
  useEffect(() => {
    if (!screen) return;
    document.title = `${screen} · Cardápio Digital`;
    if (!restaurantId) return;
    let current = true;
    if (!names.has(restaurantId)) names.set(restaurantId, api.getRestaurant(restaurantId).then((r) => r.name, () => (names.delete(restaurantId), "")));
    names.get(restaurantId)!.then((name) => {
      if (current && name) document.title = `${screen} · ${name}`;
    });
    return () => {
      current = false;
    };
  }, [screen, restaurantId]);
}
