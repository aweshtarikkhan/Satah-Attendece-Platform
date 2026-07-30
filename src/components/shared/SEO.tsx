import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, any> | Record<string, any>[];
  noIndex?: boolean;
}

const SITE_NAME = "Satah Invoices";
const BASE_URL = "https://satahinvoice.com";
const DEFAULT_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/115b7e84-ce66-4814-9dbe-8f0fb9ac2cf8/id-preview-af91ddfd--fedbade2-ff1a-4d4f-94e6-f04beae4c8e8.lovable.app-1774609957498.png";

export function SEO({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  jsonLd,
  noIndex = false,
}: SEOProps) {
  // Always self-reference: prefer explicit `path`, otherwise use current route
  let location: { pathname: string } = { pathname: "/" };
  try {
    // useLocation may throw if not under a Router (e.g. tests); fall back gracefully
    // eslint-disable-next-line react-hooks/rules-of-hooks
    location = useLocation();
  } catch {
    // ignore
  }
  const resolvedPath = path ?? location.pathname ?? "/";

  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const url = `${BASE_URL}${resolvedPath}`;
  const desc = description.length > 158 ? description.slice(0, 155) + "..." : description;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
