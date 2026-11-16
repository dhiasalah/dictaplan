export interface PriceItem {
  id: string;
  code?: string;
  label: string;
  /** English label, used in prompts/UI when language is EN */
  labelEn?: string;
  price: number;
  /** whether the price is per tooth (most) or per session/arch */
  perTooth: boolean;
}

/**
 * Indicative default fees (France, € TTC). Every practice should adjust these
 * in Settings → Tarifs. CCAM codes are left blank where not certain; the
 * dentist can fill them in.
 */
export const SEED_PRICE_LIST: PriceItem[] = [
  { id: "consult", label: "Consultation / bilan bucco-dentaire", labelEn: "Consultation / oral exam", price: 30, perTooth: false },
  { id: "pano", label: "Radiographie panoramique", labelEn: "Panoramic X-ray", price: 21.28, perTooth: false },
  { id: "retro", code: "HBQK002", label: "Radiographie rétro-alvéolaire", labelEn: "Periapical X-ray", price: 7.98, perTooth: true },
  { id: "cbct", label: "Cone beam (CBCT)", labelEn: "CBCT scan", price: 90, perTooth: false },
  { id: "detartrage", code: "HBJD001", label: "Détartrage et polissage", labelEn: "Scaling and polishing", price: 28.92, perTooth: false },
  { id: "surfacage", label: "Surfaçage radiculaire (par sextant)", labelEn: "Root planing (per sextant)", price: 80, perTooth: false },
  { id: "extraction", label: "Extraction simple", labelEn: "Simple extraction", price: 33.44, perTooth: true },
  { id: "extraction-sagesse", label: "Extraction dent de sagesse", labelEn: "Wisdom tooth extraction", price: 83.6, perTooth: true },
  { id: "composite-1", label: "Composite 1 face", labelEn: "Composite filling, 1 surface", price: 26.97, perTooth: true },
  { id: "composite-2", label: "Composite 2 faces", labelEn: "Composite filling, 2 surfaces", price: 45.38, perTooth: true },
  { id: "composite-3", label: "Composite 3 faces ou plus", labelEn: "Composite filling, 3+ surfaces", price: 54.81, perTooth: true },
  { id: "endo-incisive", label: "Traitement canalaire incisive / canine", labelEn: "Root canal, incisor / canine", price: 33.74, perTooth: true },
  { id: "endo-premolaire", label: "Traitement canalaire prémolaire", labelEn: "Root canal, premolar", price: 48.2, perTooth: true },
  { id: "endo-molaire", label: "Traitement canalaire molaire", labelEn: "Root canal, molar", price: 81.94, perTooth: true },
  { id: "retraitement", label: "Retraitement canalaire", labelEn: "Root canal retreatment", price: 150, perTooth: true },
  { id: "inlay-core", label: "Inlay-core", labelEn: "Post and core", price: 175, perTooth: true },
  { id: "couronne-provisoire", label: "Couronne provisoire", labelEn: "Temporary crown", price: 60, perTooth: true },
  { id: "couronne-metal", label: "Couronne métallique", labelEn: "Full-metal crown", price: 320, perTooth: true },
  { id: "couronne-cm", label: "Couronne céramo-métallique", labelEn: "Porcelain-fused-to-metal crown", price: 500, perTooth: true },
  { id: "couronne-zircone", label: "Couronne zircone", labelEn: "Zirconia crown", price: 550, perTooth: true },
  { id: "couronne-ceramique", label: "Couronne céramique pure", labelEn: "All-ceramic crown", price: 650, perTooth: true },
  { id: "inlay-onlay", label: "Inlay / onlay céramique", labelEn: "Ceramic inlay / onlay", price: 450, perTooth: true },
  { id: "facette", label: "Facette céramique", labelEn: "Ceramic veneer", price: 700, perTooth: true },
  { id: "bridge-3", label: "Bridge 3 éléments céramo-métallique", labelEn: "3-unit PFM bridge", price: 1400, perTooth: false },
  { id: "implant", label: "Implant (pose chirurgicale)", labelEn: "Implant placement", price: 1100, perTooth: true },
  { id: "pilier-implant", label: "Pilier implantaire", labelEn: "Implant abutment", price: 300, perTooth: true },
  { id: "couronne-implant", label: "Couronne sur implant", labelEn: "Implant crown", price: 900, perTooth: true },
  { id: "greffe-osseuse", label: "Greffe osseuse / régénération osseuse", labelEn: "Bone graft", price: 500, perTooth: true },
  { id: "sinus-lift", label: "Comblement sinusien (sinus lift)", labelEn: "Sinus lift", price: 1200, perTooth: false },
  { id: "prothese-complete", label: "Prothèse amovible complète (par arcade)", labelEn: "Complete denture (per arch)", price: 1100, perTooth: false },
  { id: "prothese-partielle", label: "Prothèse amovible partielle métallique", labelEn: "Partial metal denture", price: 900, perTooth: false },
  { id: "gouttiere", label: "Gouttière occlusale", labelEn: "Occlusal splint", price: 250, perTooth: false },
  { id: "blanchiment", label: "Blanchiment dentaire", labelEn: "Tooth whitening", price: 450, perTooth: false },
  { id: "maintenance", label: "Séance de maintenance parodontale", labelEn: "Periodontal maintenance visit", price: 70, perTooth: false },
];
