/**
 * Public API of @shelf/server: the dashboard's HTTP layer. `Api` is the contract
 * the web app is typed against; `startServer` is what `shelf ui` runs.
 */
export { createApi, type Guard } from "./app.ts";
export { type Api, type ApiErrorBody, TOKEN_HEADER } from "./contract.ts";
export { type DashboardServer, type ServeOptions, startServer } from "./serve.ts";
