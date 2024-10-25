import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { type UserConfig, defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { parseCdnUrl, formatDate } from '@tencent/jarvis-webpack-cos';

const { JAMIS } = process.env;

const cdnUrl = parseCdnUrl();
const amisAddr =
  process.env.COS_ENV === 'prod'
    ? 'static.cdn.tencent.com/cjit/jamis/9.0.0'
    : `dev-static.cdn.tencent.com/cjit/jamis${
        JAMIS != null ? '-debug' : ''
      }/9.0.0`;


// https://vitejs.dev/config/
export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  console.log(`[vite] defineConfig, `, {
    mode,
    cdnUrl,
    amisAddr,
    JAMIS /*, path: fs.readFileSync(path.resolve(__dirname, './scripts/check-login.min.js'), { encoding: 'uft-8'}) */
  });

  const config: UserConfig = {
    // define: {
    // },
    // https://vitejs.dev/config/#base
    base: mode !== 'production' ? '/' : cdnUrl,
    // Resolver
    resolve: {
      // https://vitejs.dev/config/#resolve-alias
      alias: [
        {
          // vue @ shortcut fix
          find: '@/',
          replacement: `${path.resolve(__dirname, './src')}/`
        },
        {
          find: 'src/',
          replacement: `${path.resolve(__dirname, './src')}/`
        }
      ]
    },
    // https://vitejs.dev/config/#server-options
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['..']
      }
    },
    plugins: [
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            title: 'CJAPI',
            BASE_URL: mode === 'serve' ? '/' : cdnUrl,
            amisAddr,
            RELEASE_INFO: `=== RELEASE_TIME: ${formatDate(
              new Date()
            )}, AMIS_ADDR: ${amisAddr} ====`,
            DEBUG_SCRIPT:
              JAMIS != null
                ? '<script type="module" src="/src/amis/debug.ts"></script>'
                : ''
          }
        }
      })
      // compress assets
      // https://github.com/vbenjs/vite-plugin-compression
      // viteCompression(),
    ],
    // Build Options
    // https://vitejs.dev/config/#build-options
    build: {
      target: 'es2015',
      rollupOptions: {
        output: {
          plugins: [
            mode === 'analyze'
              ? // rollup-plugin-visualizer
                // https://github.com/btd/rollup-plugin-visualizer
                visualizer({
                  open: true,
                  filename: 'dist/stats.html',
                  gzipSize: true,
                  brotliSize: true
                })
              : undefined
            /*
            // if you use Code encryption by rollup-plugin-obfuscator
            // https://github.com/getkey/rollup-plugin-obfuscator
            obfuscator({
              globalOptions: {
                debugProtection: true,
              },
            }),
            */
          ],
          chunkFileNames({ facadeModuleId, name }) {
            const matchModName =
              facadeModuleId && !!facadeModuleId.match(/src\/views\/([\w\-]+)/);
            const chunkName = matchModName
              ? `assets/${RegExp.$1}.[hash].js`
              : 'assets/[name].[hash].js';
            // console.log(`[chunkFileNames] ${facadeModuleId || name} => ${chunkName}`);
            return chunkName;
          },
          manualChunks(id, api) {
            if (id.match(/.*\.(scss|css)/)) {
              return 'index';
            }
            return 'index';
          }
        }
      }
    }
  };

  return config;
});
