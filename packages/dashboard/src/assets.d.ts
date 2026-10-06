// Bun HTML imports: the bundled page, served (and embedded by --compile) as a route.
declare module "*.html" {
  const page: import("bun").HTMLBundle;
  export default page;
}
