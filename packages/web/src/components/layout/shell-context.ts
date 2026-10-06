import { createContext, useContext } from "react";

/** Lets page headers open the navigation drawer and search on narrow screens. */
export const ShellContext = createContext<{ openNavigation: () => void; openSearch: () => void }>({
  openNavigation: () => {},
  openSearch: () => {},
});

export const useShell = () => useContext(ShellContext);
