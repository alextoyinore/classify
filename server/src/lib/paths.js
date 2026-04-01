import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// This file is in server/src/lib/paths.js
// We want PROJECT_ROOT to be server/
export const PROJECT_ROOT = join(__dirname, '../../');

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
