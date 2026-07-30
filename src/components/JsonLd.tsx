import { useEffect } from "react";

/**
 * Injects a JSON-LD <script> into the document head for the lifetime of the
 * component. Kept dependency-free for the same reason as <Seo>: helmet-style
 * libraries trigger React 18 ref warnings in this codebase.
 */
const JsonLd = ({ id, data }: { id: string; data: unknown }) => {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [id, data]);

  return null;
};

export default JsonLd;
