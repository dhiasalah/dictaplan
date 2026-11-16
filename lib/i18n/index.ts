"use client";

import { fr, type Dict } from "./fr";
import { en } from "./en";
import { useStore } from "@/lib/store";
import type { Lang } from "@/lib/ai/schema";

export const DICTS: Record<Lang, Dict> = { fr, en };

export function useT(): Dict {
  const lang = useStore((s) => s.uiLang);
  return DICTS[lang];
}

export type { Dict };
