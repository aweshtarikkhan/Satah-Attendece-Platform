export interface GeoLocationResult {
  lat: number | null;
  lng: number | null;
  address: string;
  source?: 'gps' | 'ip' | 'fallback';
}

/**
 * Robust, client-friendly geolocation capture.
 * 1. Attempts browser Geolocation with fallback from HighAccuracy to normal accuracy.
 * 2. Uses BigDataCloud Client Reverse Geocode API (CORS & browser friendly, no API key needed).
 * 3. If GPS times out, is blocked, or unsupported (common on desktops), gracefully falls back to IP-based location (ipapi.co / ipwho.is).
 * 4. Ensures `address` is ALWAYS meaningful, preventing empty `-` dashes in portal logs.
 */
export async function captureAccurateLocation(): Promise<GeoLocationResult> {
  let coords: { lat: number; lng: number } | null = null;

  // 1. Try GPS Geolocation first
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 6000,
          enableHighAccuracy: true,
          maximumAge: 30000,
        });
      });
      coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (_gpsHighErr) {
      // Retry with enableHighAccuracy: false (cell tower / wifi triangulation, faster & desktop compatible)
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false,
            maximumAge: 60000,
          });
        });
        coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      } catch (_gpsLowErr) {
        coords = null;
      }
    }
  }

  // 2. If coordinates acquired, reverse geocode to get a clear street/city address
  if (coords && coords.lat && coords.lng) {
    const lat = coords.lat;
    const lng = coords.lng;
    let address = '';

    // BigDataCloud client API (CORS friendly, works from any browser without auth token)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const parts = [
          data.locality || data.localityInfo?.administrative?.[3]?.name,
          data.city || data.localityInfo?.administrative?.[2]?.name,
          data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name,
          data.postcode,
          data.countryName,
        ].filter(Boolean);
        if (parts.length > 0) {
          address = Array.from(new Set(parts)).join(', ');
        }
      }
    } catch (_e) {}

    // Fallback: OpenStreetMap Nominatim
    if (!address) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data?.display_name) address = data.display_name;
        }
      } catch (_e) {}
    }

    if (!address) {
      address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    return {
      lat,
      lng,
      address,
      source: 'gps',
    };
  }

  // 3. Fallback to IP-based Geolocation (essential for Windows/Mac desktop browsers or if GPS is blocked)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const addrParts = [data.city, data.region, data.country_name].filter(Boolean);
        return {
          lat: Number(data.latitude),
          lng: Number(data.longitude),
          address: `${addrParts.join(', ')} (IP)`,
          source: 'ip',
        };
      }
    }
  } catch (_e) {}

  // Secondary IP provider fallback: ipwho.is
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.latitude && data.longitude) {
        const addrParts = [data.city, data.region, data.country].filter(Boolean);
        return {
          lat: Number(data.latitude),
          lng: Number(data.longitude),
          address: `${addrParts.join(', ')} (IP)`,
          source: 'ip',
        };
      }
    }
  } catch (_e) {}

  // 4. Graceful default (never crash, never block attendance punch)
  return {
    lat: null,
    lng: null,
    address: 'Workplace Device / Web Check-In',
    source: 'fallback',
  };
}
