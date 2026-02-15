import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// admin.html을 처리하는 플러그인 - Vite의 HTML 미들웨어를 완전히 우회
const adminHtmlPlugin = () => {
  return {
    name: 'admin-html',
    enforce: 'pre',
    configureServer(server) {
      // Vite의 HTML 미들웨어를 직접 수정하여 admin.html을 제외
      return () => {
        const stack = server.middlewares.stack;
        
        // HTML 미들웨어 찾기 및 수정
        for (let i = 0; i < stack.length; i++) {
          const middleware = stack[i];
          const originalHandle = middleware.handle;
          
          if (originalHandle && typeof originalHandle === 'function') {
            const handleStr = originalHandle.toString();
            const handleName = originalHandle.name;
            
            // Vite의 HTML 미들웨어 식별 (더 넓은 범위로)
            const isHtmlMiddleware = 
              handleName === 'viteIndexHtmlMiddleware' ||
              handleName === 'htmlFallbackMiddleware' ||
              handleStr.includes('index.html') ||
              handleStr.includes('transformIndexHtml') ||
              handleStr.includes('htmlFallback') ||
              handleStr.includes('html-proxy') ||
              (handleStr.includes('html') && handleStr.includes('req.url'));
            
            if (isHtmlMiddleware) {
              // 원본 미들웨어를 래핑
              const wrappedHandle = (req, res, next) => {
                // admin.html, admin-panel.html, /admin/ 모두 처리
                if (req.url === '/admin.html' || req.url === '/admin.html/' || 
                    req.url === '/admin-panel.html' || req.url === '/admin-panel.html/' ||
                    req.url === '/admin' || req.url === '/admin/') {
                  const fileName = 'admin.html';
                  const filePath = path.join(__dirname, 'public', fileName);
                  
                  if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    res.setHeader('Content-Type', 'text/html');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.statusCode = 200;
                    res.end(content);
                    return;
                  }
                }
                // 다른 경로는 원본 미들웨어 실행
                return originalHandle(req, res, next);
              };
              
              // 원본 미들웨어 교체
              stack[i].handle = wrappedHandle;
            }
          }
        }
        
        // 추가로 맨 앞에 admin 미들웨어 추가 (이중 안전장치)
        // /admin/ 경로도 처리
        const adminMiddleware = (req, res, next) => {
          // /admin.html, /admin-panel.html, /admin/ 모두 처리
          if (req.url === '/admin.html' || req.url === '/admin.html/' || 
              req.url === '/admin-panel.html' || req.url === '/admin-panel.html/' ||
              req.url === '/admin' || req.url === '/admin/') {
            const fileName = 'admin.html';
            const filePath = path.join(__dirname, 'public', fileName);
            
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf-8');
              res.setHeader('Content-Type', 'text/html');
              res.setHeader('Cache-Control', 'no-cache');
              res.statusCode = 200;
              res.end(content);
              return;
            }
          }
          next();
        };
        
        stack.unshift({
          route: '',
          handle: adminMiddleware,
        });
      };
    },
  };
};

export default defineConfig({
  plugins: [
    adminHtmlPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'RunLog - 러닝 기록 아카이브',
        short_name: 'RunLog',
        description: '러너를 위한 개인 기록 아카이브 웹앱',
        theme_color: '#1e3a8a',
        background_color: '#f0f4f8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    port: 3000,
    open: true,
    fs: {
      strict: false,
    },
  },
  publicDir: 'public',
});
