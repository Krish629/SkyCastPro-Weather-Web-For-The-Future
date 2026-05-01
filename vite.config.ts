import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'api-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/')) {
              try {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const apiPath = url.pathname.replace('/api/', '');
                const filePath = path.resolve(__dirname, `./api/${apiPath}.ts`);
                
                // Simplified module loading for dev
                const module = await server.ssrLoadModule(`./api/${apiPath}.ts`);
                const handler = module.default;
                
                if (typeof handler === 'function') {
                  const vercelReq: any = req;
                  const vercelRes: any = res;
                  
                  // Basic mock for Vercel req/res
                  vercelReq.query = Object.fromEntries(url.searchParams);
                  vercelReq.body = await new Promise((resolve) => {
                    let body = '';
                    req.on('data', chunk => body += chunk);
                    req.on('end', () => {
                      try {
                        resolve(body ? JSON.parse(body) : {});
                      } catch {
                        resolve({});
                      }
                    });
                  });
                  
                  vercelRes.status = (code: number) => {
                    res.statusCode = code;
                    return vercelRes;
                  };
                  vercelRes.json = (data: any) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                    return vercelRes;
                  };
                  
                  await handler(vercelReq, vercelRes);
                  return;
                }
              } catch (err: any) {
                console.error(`Dev API Error (${req.url}):`, err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Dev API Error', message: err.message }));
                return;
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
