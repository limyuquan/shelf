import type { RouterHistory } from "@tanstack/react-router";

/**
 * The router's history: `undefined` for the router's default, browser history.
 * A build for static hosting without a server-side fallback (the website's
 * read-only demo, scripts/site/demo) replaces this module with hash history.
 */
export const history: RouterHistory | undefined = undefined;
