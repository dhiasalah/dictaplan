"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { nanoid } from "nanoid";
import type { Lang, TreatmentPlan } from "@/lib/ai/schema";
import { SEED_PRICE_LIST, type PriceItem } from "@/lib/seed/price-list.fr";

export type Step = "dictate" | "clarify" | "review" | "export";

import { EMPTY_PRACTICE, type Practice } from "@/lib/practice";
export { EMPTY_PRACTICE, type Practice };

interface State {
  hydrated: boolean;
  uiLang: Lang;
  dictationLang: Lang;
  practice: Practice;
  priceList: PriceItem[];
  plans: Record<string, TreatmentPlan>;
  currentId: string | null;
  draftTranscript: string;
  step: Step;

  setUiLang: (l: Lang) => void;
  setDictationLang: (l: Lang) => void;
  setPractice: (p: Partial<Practice>) => void;
  setPriceList: (l: PriceItem[]) => void;
  setDraftTranscript: (t: string) => void;
  setStep: (s: Step) => void;
  /** save (insert or replace) a plan and make it current */
  savePlan: (p: TreatmentPlan) => void;
  /** update the current plan with a function */
  updateCurrent: (fn: (p: TreatmentPlan) => TreatmentPlan) => void;
  openPlan: (id: string) => void;
  duplicatePlan: (id: string) => string | null;
  deletePlan: (id: string) => void;
  newPlan: () => void;
}

const hasIDB = () => typeof indexedDB !== "undefined";
const idbStorage: StateStorage = {
  getItem: async (name) => (hasIDB() ? ((await idbGet<string>(name)) ?? null) : null),
  setItem: async (name, value) => {
    if (hasIDB()) await idbSet(name, value);
  },
  removeItem: async (name) => {
    if (hasIDB()) await idbDel(name);
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      uiLang: "fr",
      dictationLang: "fr",
      practice: EMPTY_PRACTICE,
      priceList: SEED_PRICE_LIST,
      plans: {},
      currentId: null,
      draftTranscript: "",
      step: "dictate",

      setUiLang: (uiLang) => set({ uiLang }),
      setDictationLang: (dictationLang) => set({ dictationLang }),
      setPractice: (p) => set({ practice: { ...get().practice, ...p } }),
      setPriceList: (priceList) => set({ priceList }),
      setDraftTranscript: (draftTranscript) => set({ draftTranscript }),
      setStep: (step) => set({ step }),
      savePlan: (p) => {
        const plan = { ...p, updatedAt: new Date().toISOString() };
        set({ plans: { ...get().plans, [plan.id]: plan }, currentId: plan.id });
      },
      updateCurrent: (fn) => {
        const { currentId, plans } = get();
        if (!currentId || !plans[currentId]) return;
        const next = { ...fn(plans[currentId]), updatedAt: new Date().toISOString() };
        set({ plans: { ...plans, [currentId]: next } });
      },
      openPlan: (id) => {
        const p = get().plans[id];
        if (!p) return;
        set({ currentId: id, draftTranscript: p.transcript, step: "review" });
      },
      duplicatePlan: (id) => {
        const p = get().plans[id];
        if (!p) return null;
        const copy: TreatmentPlan = {
          ...structuredClone(p),
          id: nanoid(10),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "draft",
        };
        set({ plans: { ...get().plans, [copy.id]: copy } });
        return copy.id;
      },
      deletePlan: (id) => {
        const plans = { ...get().plans };
        delete plans[id];
        set({ plans, currentId: get().currentId === id ? null : get().currentId });
      },
      newPlan: () => set({ currentId: null, draftTranscript: "", step: "dictate" }),
    }),
    {
      name: "dictaplan",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        uiLang: s.uiLang,
        dictationLang: s.dictationLang,
        practice: s.practice,
        priceList: s.priceList,
        plans: s.plans,
        currentId: s.currentId,
        draftTranscript: s.draftTranscript,
        step: s.step,
      }),
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

export function useCurrentPlan(): TreatmentPlan | null {
  return useStore((s) => (s.currentId ? (s.plans[s.currentId] ?? null) : null));
}
