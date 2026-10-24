/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryBasePath = "/Learned_Media";

const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: isGitHubPages ? repositoryBasePath : "" },
  ...(isGitHubPages ? {
    output: "export",
    basePath: repositoryBasePath,
    assetPrefix: repositoryBasePath + "/",
    trailingSlash: true
  } : {}),
  images: {
    unoptimized: isGitHubPages,
    remotePatterns: []
  }
};

export default nextConfig;
