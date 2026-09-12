import { ThemeMenu } from "./components/layout/theme-menu";
import { ThemeSync } from "./stores/theme-store";

export function App() {
  return (
    <main>
      <ThemeSync />
      <h1>MyContext</h1>
      <ThemeMenu />
    </main>
  );
}
