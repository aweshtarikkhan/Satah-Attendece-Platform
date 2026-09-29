import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely format any time value (12h format like "09:30 AM", 24h like "09:30:00",
 * ISO string, or Date) without throwing RangeError: Invalid time value.
 */
export function safeFormatTime(timeVal: any, fallback = "-"): string {
  if (!timeVal) return fallback;
  if (typeof timeVal === "string") {
    const trimmed = timeVal.trim();
    if (!trimmed) return fallback;
    if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      try {
        const [hh, mm] = trimmed.split(":");
        const h = parseInt(hh, 10);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${String(h12).padStart(2, "0")}:${mm} ${ampm}`;
      } catch {
        return trimmed;
      }
    }
    try {
      const d = parseISO(trimmed);
      if (!isNaN(d.getTime())) {
        return format(d, "hh:mm a");
      }
    } catch {}
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return format(d, "hh:mm a");
      }
    } catch {}
    return trimmed;
  }
  if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
    try {
      return format(timeVal, "hh:mm a");
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Safely format any date value without throwing RangeError: Invalid time value.
 */
export function safeFormatDate(dateVal: any, formatPattern = "MMM dd, yyyy", fallback = "-"): string {
  if (!dateVal) return fallback;
  try {
    if (typeof dateVal === "string") {
      const d = parseISO(dateVal);
      if (!isNaN(d.getTime())) {
        return format(d, formatPattern);
      }
      const d2 = new Date(dateVal);
      if (!isNaN(d2.getTime())) {
        return format(d2, formatPattern);
      }
    } else if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      return format(dateVal, formatPattern);
    }
  } catch {}
  return fallback;
}

