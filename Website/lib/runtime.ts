export function isGitHubPagesRuntime() {
  if (process.env.NEXT_PUBLIC_GITHUB_PAGES === "true") return true;
  return typeof window !== "undefined" && window.location.hostname.endsWith(".github.io");
}
