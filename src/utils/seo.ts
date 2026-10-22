export type SeoInput = {
  title: string;
  description: string;
  // 公開URLのオリジン（例: https://example.com）。画像などを絶対URLにするために使う。
  origin: string;
  siteName: string;
  // オリジンからの相対パス。
  imagePath: string;
  imageAlt: string;
};

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const absoluteUrl = (origin: string, path: string) => new URL(path, origin).toString();

// Open Graphは property、Twitterカードと通常のメタは name で出力する。
// 引数にはサービス共通の文言だけを渡す。ワークスペースやタスクなどの非公開データは渡さない。
export const seo = ({ title, description, origin, siteName, imagePath, imageAlt }: SeoInput) => {
  const image = absoluteUrl(origin, imagePath);
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: siteName },
    { property: "og:locale", content: "ja_JP" },
    { property: "og:url", content: absoluteUrl(origin, "/") },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: String(OG_IMAGE_SIZE.width) },
    { property: "og:image:height", content: String(OG_IMAGE_SIZE.height) },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imageAlt },
  ];
};
