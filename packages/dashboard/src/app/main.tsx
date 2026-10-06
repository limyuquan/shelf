import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { ActivityView } from "./views/activity.tsx";
import { LibraryView } from "./views/library.tsx";
import { ProjectView } from "./views/project.tsx";
import { ProjectsView } from "./views/projects.tsx";
import { SkillView } from "./views/skill.tsx";

/** Hash routes: #/, #/projects/:id, #/library, #/library/:name, #/activity */
function useRoute(): string[] {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
}

function Page({ route }: { route: string[] }) {
  const [section, id] = route;
  if (section === "projects" && id) return <ProjectView key={id} id={id} />;
  if (section === "library" && id) return <SkillView key={id} name={id} />;
  if (section === "library") return <LibraryView />;
  if (section === "activity") return <ActivityView />;
  return <ProjectsView />;
}

function App() {
  const route = useRoute();
  const section = route[0] ?? "projects";
  const link = (href: string, label: string, name: string) => (
    <a href={href} class={section === name ? "active" : ""}>
      {label}
    </a>
  );
  return (
    <>
      <header>
        <span class="brand">shelf</span>
        <nav>
          {link("#/", "Projects", "projects")}
          {link("#/library", "Library", "library")}
          {link("#/activity", "Activity", "activity")}
        </nav>
      </header>
      <main>
        <Page route={route} />
      </main>
    </>
  );
}

const root = document.getElementById("app");
if (root) render(<App />, root);
