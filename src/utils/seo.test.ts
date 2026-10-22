import { describe, expect, it } from "vite-plus/test";
import { seo } from "./seo";

const input = {
  title: "Roadmap Studio",
  description: "説明文",
  origin: "https://roadmap.example.com",
  siteName: "Roadmap Studio",
  imagePath: "/og-image.png",
  imageAlt: "代替テキスト",
};

type Tag = { name?: string; property?: string; content?: string };
const find = (tags: Tag[], key: "name" | "property", value: string) =>
  tags.find((tag) => tag[key] === value)?.content;

describe("seo", () => {
  const tags: Tag[] = seo(input);

  it("Open Graphのタグは property 属性で出力し、name では出力しない", () => {
    expect(tags.filter((tag) => tag.name?.startsWith("og:"))).toEqual([]);
    expect(find(tags, "property", "og:title")).toBe("Roadmap Studio");
    expect(find(tags, "property", "og:description")).toBe("説明文");
    expect(find(tags, "property", "og:type")).toBe("website");
    expect(find(tags, "property", "og:site_name")).toBe("Roadmap Studio");
    expect(find(tags, "property", "og:locale")).toBe("ja_JP");
    expect(find(tags, "property", "og:url")).toBe("https://roadmap.example.com/");
  });

  it("画像は絶対URLで、サイズと代替テキストを伴い、大きな画像のカードにする", () => {
    expect(find(tags, "property", "og:image")).toBe("https://roadmap.example.com/og-image.png");
    expect(find(tags, "property", "og:image:width")).toBe("1200");
    expect(find(tags, "property", "og:image:height")).toBe("630");
    expect(find(tags, "property", "og:image:alt")).toBe("代替テキスト");
    expect(find(tags, "name", "twitter:card")).toBe("summary_large_image");
    expect(find(tags, "name", "twitter:image")).toBe("https://roadmap.example.com/og-image.png");
  });

  it("テンプレート由来のTwitterアカウントを含まない", () => {
    expect(JSON.stringify(tags)).not.toContain("tannerlinsley");
    expect(find(tags, "name", "twitter:creator")).toBeUndefined();
    expect(find(tags, "name", "twitter:site")).toBeUndefined();
  });

  it("オリジンにパスが付いていても画像URLはオリジン直下から解決する", () => {
    const result: Tag[] = seo({ ...input, origin: "https://roadmap.example.com/app/" });
    expect(find(result, "property", "og:image")).toBe("https://roadmap.example.com/og-image.png");
  });
});
