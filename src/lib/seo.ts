const SITE = "https://trickmachina.com";
const IMAGE = `${SITE}/og.jpg`;

export function pageHead(title: string, description: string, path: string, image?: string, imageSize?: { width: number; height: number }) {
  const url = path === "/" ? `${SITE}/` : `${SITE}${path}`;
  const picture = image && /^https?:\/\//.test(image) ? image : IMAGE;
  const width = String(imageSize?.width ?? 1200);
  const height = String(imageSize?.height ?? 630);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Trick Machina" },
      { property: "og:url", content: url },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: picture },
      { property: "og:image:width", content: width },
      { property: "og:image:height", content: height },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: picture },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}