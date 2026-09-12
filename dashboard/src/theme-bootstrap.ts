try {
  const saved = JSON.parse(localStorage.getItem("mycontext-theme") || "{}") as {
    state?: { theme?: "light" | "dark" | "system" };
  };
  const theme = saved.state?.theme || "system";
  const dark = theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
} catch {
  // The local preference is optional; the app store will apply its fallback.
}
