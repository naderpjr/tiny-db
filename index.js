import readline from 'node:readline';
import { TinyDB } from './src/db.js';
import { run } from './src/shell.js';

const db = new TinyDB(process.argv[2] ?? 'demo.db');
console.log(`TinyDB ready (${db.stats().logLines} log lines, ${db.skipped} corrupt skipped)`);
console.log('Type "help" for commands.');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'tinydb> ',
});

rl.prompt();
rl.on('line', (line) => {
    if (['exit', 'quit'].includes(line.trim())) return rl.close();
    try {
        const out = run(db, line);
        if (out) console.log(out);
    } catch (e) {
        console.log('ERROR: ' + e.message);
    }
    rl.prompt();
});
rl.on('close', () => {
    db.close();
    console.log('bye');
});