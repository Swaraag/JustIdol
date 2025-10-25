import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark ffmpeg and ffprobe installers as external to prevent bundling
      config.externals = config.externals || [];
      config.externals.push({
        "@ffmpeg-installer/ffmpeg": "commonjs @ffmpeg-installer/ffmpeg",
        "@ffprobe-installer/ffprobe": "commonjs @ffprobe-installer/ffprobe",
      });
    }
    return config;
  },
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
    "sharp",
  ],
};

export default nextConfig;
