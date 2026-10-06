const STORAGE_KEY = "shelf.token";

/**
 * The access token from the URL `shelf ui` printed. It is moved to localStorage
 * and removed from the address bar, so it is not left in history or shared by
 * copying the URL, and so a bookmark or home-screen shortcut keeps working.
 */
export function readToken(): string {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get("token");
  if (fromUrl) {
    saveToken(fromUrl);
    url.searchParams.delete("token");
    history.replaceState(history.state, "", url);
  }
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function saveToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token.trim());
}
