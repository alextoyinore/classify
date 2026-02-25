import { execSync } from 'child_process';
import fs from 'fs';

const sqlData = fs.readFileSync('schema_final.sql', 'utf8');
const commands = sqlData.split(';').map(c => c.trim()).filter(c => c.length > 0);

console.log(`Found ${commands.length} commands.`);

const psqlPath = '"C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\runtime\\psql.exe"';
const conn = '-U classify_user -h 127.0.0.1 -d classify_db';

process.env.PGPASSWORD = '12345abcde';

for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i] + ';';
    console.log(`Executing ${i + 1}/${commands.length}...`);
    try {
        // We use a temporary file for each command to avoid command-line length limits and escaping hell
        fs.writeFileSync('temp_cmd.sql', cmd);
        execSync(`${psqlPath} ${conn} -f temp_cmd.sql --no-align --quiet`, { stdio: 'inherit' });
    } catch (err) {
        console.error(`❌ Failed at command ${i + 1}:`);
        console.error(cmd);
        // continue or break? let's continue to see how far we get
    }
}
console.log('Finished.');
