import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { FiExternalLink, FiGlobe, FiRefreshCw } from "react-icons/fi";
import { cardClass, secondaryButtonClass } from "./ui";

const iconButtonClass =
  "flex size-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5";

// The seller's real website, sent `message` whenever it changes so it can try a
// look on live. Nothing is saved by this: see BrandPreviewListener on the site.
const WebsiteFrame = ({ url, message }: { url: string; message: Record<string, string> }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [path, setPath] = useState("/");
  const [reloads, setReloads] = useState(0);
  const origin = new URL(url).origin;
  const serialized = JSON.stringify(message);

  const send = useRef(() => {});
  send.current = () => frame.current?.contentWindow?.postMessage(JSON.parse(serialized), origin);

  useEffect(() => send.current(), [serialized, origin]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type !== "brand-preview:ready") return;
      setPath(String(event.data.path ?? "/"));
      send.current();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin]);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="size-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <p className="min-w-0 flex-1 truncate rounded-lg bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
          {new URL(url).host}
          {path === "/" ? "" : path}
        </p>
        <button
          type="button"
          title="Reload website"
          aria-label="Reload website"
          onClick={() => {
            setPath("/");
            setReloads((n) => n + 1);
          }}
          className={iconButtonClass}
        >
          <FiRefreshCw className="size-4" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Open website in a new tab"
          aria-label="Open website in a new tab"
          className={iconButtonClass}
        >
          <FiExternalLink className="size-4" />
        </a>
      </div>
      <iframe
        key={reloads}
        ref={frame}
        src={url}
        title="Seller website preview"
        onLoad={() => send.current()}
        className="h-[calc(100vh-10rem)] min-h-[640px] w-full bg-white"
      />
    </>
  );
};

const WebsitePreview = ({ url, message }: { url: string; message: Record<string, string> }) => (
  <section className={`${cardClass} min-w-0 overflow-hidden`}>
    {url ? (
      <WebsiteFrame url={url} message={message} />
    ) : (
      <div className="flex min-h-[640px] flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <FiGlobe className="size-5" />
        </span>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No live website yet</p>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          The preview shows this seller's real website, so it needs an active domain.
          Changes can still be saved now.
        </p>
        <Link to="?tab=domains" className={secondaryButtonClass}>Go to Domains</Link>
      </div>
    )}
  </section>
);

export default WebsitePreview;
