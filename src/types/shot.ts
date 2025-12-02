// src/types/shot.ts

// Core model for a single HRT shot log.
// Intentionally PII-free: only HRT-related fields.
export interface ShotEntry {
  id: string;             // local-only ID
  date: string;           // YYYY-MM-DD
  time?: string;          // HH:MM
  doseMg?: number;        // numeric dose (unit configurable later)
  injectionSite?: string; // e.g. "thigh", "glute", "stomach"
  painScore?: number;     // 0–10
  mood?: string;          // free text or later enum
  notes?: string;         // long-form notes
}
