const PREVIEW_HOST_PATTERNS = [
  ".lovableproject.com",
  ".lovableproject-dev.com",
  ".beta.lovable.dev",
];

function isPreviewOrDevHost(hostname: string) {
  return (
    !import.meta.env.PROD ||
    hostname === "lovableproject.com" ||
    hostname === "lovableproject-dev.com" ||
    hostname === "beta.lovable.dev" ||
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    PREVIEW_HOST_PATTERNS.some((suffix) => hostname.endsWith(suffix))
  );
}

function isSatahCache(name: string) {
  return name === "satah-v1" || name === "satah-v2" || name.startsWith("satah-");
}

export async function cleanupStaleServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  const shouldCleanup = isPreviewOrDevHost(window.location.hostname) || new URLSearchParams(window.location.search).get("sw") === "off";
  if (!shouldCleanup) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((registration) => new URL(registration.scope).origin === window.location.origin)
        .map((registration) => registration.unregister()),
    );

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.allSettled(cacheNames.filter(isSatahCache).map((name) => caches.delete(name)));
    }
  } catch {
    // Best-effort cleanup only.
  }
}

export function setupWebAppManifest() {
  if (isPreviewOrDevHost(window.location.hostname)) return;
  if (document.querySelector('link[rel="manifest"]')) return;

  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "/manifest.webmanifest";
  document.head.appendChild(manifest);
}