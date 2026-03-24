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

    // Copy .env to dist
    const envSource = path.join(__dirname, 'server', '.env');
    const envDest = path.join(__dirname, 'server', 'dist', '.env');
    if (fs.existsSync(envSource)) {
        fs.copyFileSync(envSource, envDest);
        console.log('📄 .env copied to server/dist/.env');
    }

    // Create package.json for deployment
    const pkg = {
        name: "classify-deployment",
        version: "1.0.0",
        type: "module",
        main: "index.js",
        dependencies: {
            // These are the only ones left as external because they use native binaries or special loading
            "@prisma/client": "^5.22.0",
            "prisma": "^5.22.0"
        }
    };
    fs.writeFileSync(path.join(__dirname, 'server', 'dist', 'package.json'), JSON.stringify(pkg, null, 2));
    console.log('📦 Deployment package.json created');

    // Copy prisma folder to dist
    const prismaSource = path.join(__dirname, 'server', 'prisma');
    const prismaDest = path.join(__dirname, 'server', 'dist', 'prisma');
    if (fs.existsSync(prismaSource)) {
        fs.cpSync(prismaSource, prismaDest, { recursive: true });
        console.log('📂 Prisma schema copied to server/dist/prisma');
    }

    // Ensure uploads directory exists in dist
    const uploadsDest = path.join(__dirname, 'server', 'dist', 'uploads');
    if (!fs.existsSync(uploadsDest)) {
        fs.mkdirSync(uploadsDest, { recursive: true });
        console.log('📁 uploads directory created in server/dist/uploads');
    }

    // Bundle seed.js for standalone use
    console.log('🌱 Bundling seed script...');
    esbuild.build({
        entryPoints: [path.join(__dirname, 'server', 'src', 'seed.js')],
        bundle: true,
        platform: 'node',
        target: 'node18',
        format: 'esm',
        outfile: path.join(__dirname, 'server', 'dist', 'seed.js'),
        minify: true,
        sourcemap: false,
        external: ['@prisma/client', 'prisma'],
        banner: {
            js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
        },
    }).then(() => {
        console.log('✅ Seed script bundled successfully to server/dist/seed.js');
    }).catch(err => {
        console.error('❌ Seed bundling failed:', err);
    });

    // Copy essential node_modules (Prisma engines and client) to dist
    // This allows "no-install" deployment if everything else is bundled
    const modulesDest = path.join(__dirname, 'server', 'dist', 'node_modules');
    if (!fs.existsSync(modulesDest)) {
        fs.mkdirSync(modulesDest, { recursive: true });
    }

    const prismaModules = ['.prisma', '@prisma', 'prisma'];
    prismaModules.forEach(mod => {
        const src = path.join(__dirname, 'server', 'node_modules', mod);
        const dest = path.join(modulesDest, mod);
        if (fs.existsSync(src)) {
            fs.cpSync(src, dest, { recursive: true });
            console.log(`📦 Packed node_modules/${mod}`);
        }
    });

    // Copy .bin/prisma binaries so npx works
    const binSrc = path.join(__dirname, 'server', 'node_modules', '.bin');
    const binDest = path.join(modulesDest, '.bin');
    if (fs.existsSync(binSrc)) {
        if (!fs.existsSync(binDest)) fs.mkdirSync(binDest, { recursive: true });
        const prismaBins = ['prisma', 'prisma.cmd', 'prisma.ps1'];
        prismaBins.forEach(file => {
            const fSrc = path.join(binSrc, file);
            const fDest = path.join(binDest, file);
            if (fs.existsSync(fSrc)) {
                fs.copyFileSync(fSrc, fDest);
            }
        });
        console.log('📦 Packed node_modules/.bin/prisma executables');
    }
}).catch((err) => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
