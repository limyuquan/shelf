// Markdown files imported with `with { type: "text" }` are embedded as strings.
declare module "*.md" {
  const content: string;
  export default content;
}
