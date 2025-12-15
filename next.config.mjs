/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // This is to ensure that you can use the 'ws' package with Next.js.
    // It's often a dependency of other packages.
    if (isServer) {
      config.externals.push('ws');
    }

    // Add a rule to handle .node files, which might be used by some native packages
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    return config;
  },
};

export default nextConfig;
