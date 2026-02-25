import { execSync } from 'child_process';
try {
    const cmd = 'cmd /c "set PGPASSWORD=12345abcde && \\"C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\runtime\\psql.exe\\" -U classify_user -h 127.0.0.1 -d classify_db -c \\"SELECT version();\\" --no-align --quiet"';
    const out = execSync(cmd, { encoding: 'utf8' });
    console.log('Postgres Version:', out.split('\n')[0]);
} catch (err) {
    console.error('Check failed:', err.message);
}
