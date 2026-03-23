import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.join(__dirname, 'server', 'src', 'index.js');
const outfile = path.join(__dirname, 'server', 'dist', 'index.js');
const clientDist = path.join(__dirname, 'client', 'dist');
const publicDir = path.join(__dirname, 'server', 'dist', 'public');

console.log('🚀 Bundling backend...');

esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: outfile,
    minify: true,
    sourcemap: false,
    external: ['@prisma/client', 'prisma'],
    banner: {
        js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
}).then(() => {
    console.log('✅ Backend bundled successfully to server/dist/index.js');
    
    // Copy client/dist to server/dist/public
    console.log('📂 Packaging client into server/dist/public...');
    if (fs.existsSync(clientDist)) {
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.cpSync(clientDist, publicDir, { recursive: true });
        console.log('✅ Client packaged successfully!');
    } else {
        console.warn('⚠️ Warning: client/dist not found. Please run build-client first.');
    }
}).catch((err) => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
