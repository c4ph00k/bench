/** The two things every page needs: everyone in the rolodex, and a way to say something happened. */
import { createContext, useContext } from "react";
import type { PersonComputed } from "./types";

export interface Store {
  people: PersonComputed[];
  tags: string[];
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const StoreContext = createContext<Store | null>(null);
export const ToastContext = createContext<((text: string) => void) | null>(
  null,
);

export function useStore(): Store {
  return useContext(StoreContext)!;
}

/** Shows a short confirmation. Every page is inside the provider, so this is never null. */
export function useToast(): (text: string) => void {
  return useContext(ToastContext)!;
}
