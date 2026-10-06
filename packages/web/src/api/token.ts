const STORAGE_KEY = "shelf.token";

/**
 * The per-process token from the URL `shelf ui` printed. It is moved to
 * sessionStorage and removed from the address bar, so it is not left in
 * history or shared by copying the URL.
 */
export function readToken(): string {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get("token");
  if (fromUrl) {
    sessionStorage.setItem(STORAGE_KEY, fromUrl);
    url.searchParams.delete("token");
    history.replaceState(history.state, "", url);
  }
  return sessionStorage.getItem(STORAGE_KEY) ?? "";
}
