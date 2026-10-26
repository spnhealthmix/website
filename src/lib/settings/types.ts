export interface BusinessAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface SocialLinks {
  instagram?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  twitter?: string | null;
}

export interface BusinessSettings {
  businessName: string;
  supportEmail: string;
  phone: string | null;
  whatsapp: string | null;
  address: BusinessAddress | null;
  fssaiNumber: string | null;
  gstin: string | null;
  socialLinks: SocialLinks | null;
  footerText: string | null;
  updatedAt?: string | null;
}

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: "SPN Health Mix",
  supportEmail: "spnhealthmix@gmail.com",
  phone: "+91 70949 38940",
  whatsapp: "+91 70949 38940",
  address: {
    line1: "No. 257, Vaguthupatti Village",
    line2: "Krishnapuram PT",
    city: "Dharmapuri",
    state: "Tamil Nadu",
    pincode: "635202",
  },
  fssaiNumber: "22425032000829",
  gstin: "33GACPM7047B1ZZ",
  socialLinks: {
    instagram: "https://instagram.com/spn_healthmix",
  },
  footerText: "Traditional Indian food crafted for modern households. Nutrient-dense health mixes, freshly roasted podis, and pure spices made with care.",
  updatedAt: null,
};
