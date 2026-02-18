/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开发模式下禁用静态导出以支持 DuckDB
  ...(process.env.NODE_ENV === 'production' ? {
    output: 'export',
    distDir: 'dist',
  } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // 将 DuckDB 标记为外部模块，不打包
    config.externals = config.externals || [];
    
    if (typeof config.externals === 'function') {
      config.externals = [config.externals];
    }
    
    config.externals.push(({ context, request }, callback) => {
      if (request === 'duckdb' || request?.startsWith('duckdb/')) {
        return callback(null, `commonjs ${request}`);
      }
      callback();
    });
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        zlib: false,
        os: false,
        url: false,
        assert: false,
        constants: false,
        child_process: false,
        dns: false,
        dgram: false,
        cluster: false,
        module: false,
        readline: false,
        repl: false,
        vm: false,
        v8: false,
        inspector: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
