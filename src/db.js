import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { encode, decode } from './log.js';
import { matches, applyPatch } from './query.js';

export class TinyDB {
    cols = new Map(); 
    lines = 0;        
    skipped = 0;      

    constructor(file) {
        this.file = file;
        this.#load();
        this.fd = fs.openSync(file, 'a');
    }


    #load() {
        if (!fs.existsSync(this.file)) return;
        const text = fs.readFileSync(this.file, 'utf8');
        for (const line of text.split('\n')) {
            if (!line) continue;
            const op = decode(line);
            if (op) {
                this.#apply(op);
                this.lines++;
            } else {
                this.skipped++;
            }
        }

        if (text && !text.endsWith('\n')) fs.appendFileSync(this.file, '\n');
    }


    #apply({ type, col, id, doc }) {
        if (!this.cols.has(col)) this.cols.set(col, new Map());
        const docs = this.cols.get(col);
        if (type === 'put') docs.set(id, doc);
        if (type === 'del') docs.delete(id);
    }


    #write(ops) {
        if (!ops.length) return;
        fs.writeSync(this.fd, ops.map(encode).join(''));
        fs.fsyncSync(this.fd);
        ops.forEach((op) => this.#apply(op));
        this.lines += ops.length;
    }

    #select(col, query) {
        const docs = this.cols.get(col)?.values() ?? [];
        return [...docs].filter((d) => matches(d, query));
    }



    insert(col, doc) {
        const id = String(doc._id ?? randomUUID().slice(0, 8));
        if (this.cols.get(col)?.has(id)) throw new Error(`Duplicate _id: ${id}`);
        const full = { ...doc, _id: id };
        this.#write([{ type: 'put', col, id, doc: full }]);
        return structuredClone(full);
    }

    find(col, query = {}, { sort, limit } = {}) {
        let rows = this.#select(col, query);
        if (sort) {
            const [field, dir] = Object.entries(sort)[0];
            rows.sort((a, b) => (a[field] > b[field] ? dir : a[field] < b[field] ? -dir : 0));
        }
        if (limit) rows = rows.slice(0, limit);
        return structuredClone(rows); 
    }

    count(col, query = {}) {
        return this.#select(col, query).length;
    }

    update(col, query, patch) {
        const ops = this.#select(col, query).map((d) => ({
            type: 'put', col, id: d._id, doc: applyPatch(d, patch),
        }));
        this.#write(ops);
        return ops.length;
    }

    remove(col, query) {
        const ops = this.#select(col, query).map((d) => ({ type: 'del', col, id: d._id }));
        this.#write(ops);
        return ops.length;
    }


    compact() {
        let out = '';
        let n = 0;
        for (const [col, docs] of this.cols) {
            for (const [id, doc] of docs) {
                out += encode({ type: 'put', col, id, doc });
                n++;
            }
        }
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, out);
        fs.closeSync(this.fd);
        fs.renameSync(tmp, this.file); 
        this.fd = fs.openSync(this.file, 'a');
        this.lines = n;
    }

    stats() {
        const collections = {};
        for (const [col, docs] of this.cols) collections[col] = docs.size;
        return {
            file: this.file,
            sizeBytes: fs.statSync(this.file).size,
            collections,
            logLines: this.lines,
            skippedLines: this.skipped,
        };
    }

    close() {
        fs.closeSync(this.fd);
    }
}