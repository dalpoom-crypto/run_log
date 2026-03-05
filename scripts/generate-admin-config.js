/**
 * 빌드 시 환경 변수로 public/admin-config.js 를 생성합니다.
 * Vercel 등에서는 Environment Variables에 아래 값을 설정하세요.
 * 로컬에서는 .env에 VITE_FIREBASE_* 를 설정하면 됩니다.
 *
 * 사용 변수: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
 * VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET,
 * VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID,
 * VITE_FIREBASE_MEASUREMENT_ID (선택)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 로컬 빌드 시 .env 로드 (Vercel에서는 이미 process.env에 주입됨)
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*VITE_FIREBASE_[A-Z_]+\s*=\s*(.*)$/);
    if (match) {
      const key = line.slice(0, line.indexOf('=')).trim();
      const value = match[1].replace(/^["']|["']$/g, '').trim();
      process.env[key] = value;
    }
  }
}

const env = process.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

if (env.VITE_FIREBASE_MEASUREMENT_ID) {
  config.measurementId = env.VITE_FIREBASE_MEASUREMENT_ID;
}

const content = `// 빌드 시 scripts/generate-admin-config.js 에 의해 생성됨. 환경 변수(VITE_FIREBASE_*) 사용.
window.RUNLOG_ADMIN_FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};
`;

const outDir = join(process.cwd(), 'public');
const outPath = join(outDir, 'admin-config.js');

try {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, content, 'utf8');
  console.log('Generated public/admin-config.js from environment variables.');
} catch (err) {
  console.error('Failed to generate admin-config.js:', err.message);
  process.exit(1);
}
