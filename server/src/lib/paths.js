import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Robust path detection for Dev (server/src/lib/) vs Prod (server/dist/)
const isSrc = basename(dirname(__dirname)) === 'src';

export const PROJECT_ROOT = isSrc
    ? join(__dirname, '..', '..') // server/src/lib -> server/
    : join(__dirname, '');       // server/dist/ -> server/dist/

export const UPLOADS_DIR = join(PROJECT_ROOT, 'uploads');
export const DATA_DIR = join(PROJECT_ROOT, 'data');
export const BACKUPS_DIR = join(UPLOADS_DIR, 'backups');
export const LOGOS_DIR = join(UPLOADS_DIR, 'logos');

// Ensure directories exist
[UPLOADS_DIR, DATA_DIR, BACKUPS_DIR, LOGOS_DIR].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (err) {
        console.error(`Failed to create directory ${dir}:`, err.message);
    }
});

