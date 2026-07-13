// src/types/shot.ts

// Core model for a single HRT shot log.
// Intentionally PII-free: only HRT-related fields.
export interface ShotEntry {
  id: string;             // local-only ID
  date: string;           // YYYY-MM-DD
  time?: string;          // HH:MM
  doseMg?: number;        // numeric dose (unit configurable later)
  injectionSite?: string; // e.g. "thigh", "glute", "stomach"
  injectionSitePosition?: string; // e.g. "left", "right", "upper left"
  testosteroneEster?: string; // e.g. "cypionate", "enanthate"
  carrierOil?: string;    // e.g. "cottonseed", "sesame", "grapeseed"
  painScore?: number;     // 0–10
  mood?: string;          // free text or later enum
  notes?: string;         // long-form notes
}
