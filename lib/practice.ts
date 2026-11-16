export interface Practice {
  name: string;
  dentist: string;
  address: string;
  phone: string;
  email: string;
  rpps: string;
  logo?: string; // data URL
  signature?: string; // data URL
  validityMonths: number;
}

export const EMPTY_PRACTICE: Practice = {
  name: "",
  dentist: "",
  address: "",
  phone: "",
  email: "",
  rpps: "",
  validityMonths: 3,
};
