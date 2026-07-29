import { useEffect } from "react";

const SITE = "https://financial.norvenhealth.com";

type TagSpec = { sel: string; attrs: Record<string, string> };

/** Upsert a head tag and report whether we created it (so we can clean up). */
function upsert({ sel, attrs }: TagSpec): { el: Element; created: boolean; prev: Record<string, string | null> } {
  let el = document.head.querySelector(sel);
  const created = !el;
  if (!el) {
    el = document.createElement(sel.startsWith("link") ? "link" : "meta");
    document.head.appendChild(el);
  }
  const prev: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(attrs)) {
    prev[k] = el.getAttribute(k);
    el.setAttribute(k, v);
  }
  return { el, created, prev };
}

/**
 * Per-route head tags: title, description, canonical and matching og/twitter.
 *
 * Implemented with direct DOM writes rather than a helmet library — the
 * provider-based libraries clone children with refs, which logs React 18
 * "Function components cannot be given refs" warnings on every render.
 */
const Seo = ({
  title,
  description,
  path,
  noindex,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}) => {
  useEffect(() => {
    const url = `${SITE}${path}`;
    const prevTitle = document.title;
    document.title = title;

    const specs: TagSpec[] = [
      { sel: 'meta[name="description"]', attrs: { name: "description", content: description } },
      { sel: 'link[rel="canonical"]', attrs: { rel: "canonical", href: url } },
      { sel: 'meta[property="og:title"]', attrs: { property: "og:title", content: title } },
      { sel: 'meta[property="og:description"]', attrs: { property: "og:description", content: description } },
      { sel: 'meta[property="og:url"]', attrs: { property: "og:url", content: url } },
      { sel: 'meta[name="twitter:title"]', attrs: { name: "twitter:title", content: title } },
      { sel: 'meta[name="twitter:description"]', attrs: { name: "twitter:description", content: description } },
    ];
    if (noindex) {
      specs.push({ sel: 'meta[name="robots"]', attrs: { name: "robots", content: "noindex, nofollow" } });
    }

    const applied = specs.map(upsert);

    return () => {
      document.title = prevTitle;
      for (const { el, created, prev } of applied) {
        if (created) {
          el.remove();
          continue;
        }
        for (const [k, v] of Object.entries(prev)) {
          if (v === null) el.removeAttribute(k);
          else el.setAttribute(k, v);
        }
      }
    };
  }, [title, description, path, noindex]);

  return null;
};

export default Seo;
