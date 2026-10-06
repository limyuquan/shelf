import { Dialog, DialogLayout } from "../ui/dialog.tsx";
import { Kbd } from "../ui/kbd.tsx";

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: "Anywhere",
    keys: [
      [["⌘", "K"], "Search and commands"],
      [["G", "A"], "Go to Attention"],
      [["G", "P"], "Go to Projects"],
      [["G", "L"], "Go to Library"],
      [["G", "Y"], "Go to Activity"],
      [["G", "S"], "Go to Settings"],
      [["?"], "Show shortcuts"],
    ],
  },
  {
    title: "Lists",
    keys: [
      [["J"], "Next row"],
      [["K"], "Previous row"],
      [["↵"], "Open"],
      [["R"], "Renew"],
      [["U"], "Update to latest"],
      [["C"], "Review changes"],
      [["B"], "Borrow skills (project page)"],
      [["/"], "Filter (library)"],
    ],
  },
  { title: "Editor", keys: [[["⌘", "S"], "Save"]] },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="w-[min(520px,calc(100vw-32px))]">
      <DialogLayout title="Keyboard shortcuts">
        <div className="flex flex-col gap-5">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1.5 font-medium text-[12px] text-fg-subtle">{group.title}</h3>
              {group.keys.map(([keys, label]) => (
                <div key={label} className="flex h-8 items-center justify-between text-[13px]">
                  <span className="text-fg">{label}</span>
                  <span className="flex gap-1">
                    {keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </DialogLayout>
    </Dialog>
  );
}
