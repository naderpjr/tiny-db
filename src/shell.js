const HELP = `Commands:
  insert <col> <json>            insert users {"name":"John","age":20}
  find <col> [json]              find users {"age":{"$gt":18}}
  count <col> [json]             count users {"city":"London"}
  update <col> <query> => <patch>  update users {"name":"John"} => {"$inc":{"age":1}}
  remove <col> <json>            remove users {"age":{"$lt":18}}
  seed | stats | compact | help | exit`;

const json = (text) => (text ? JSON.parse(text) : {});

export function run(db, line) {
    if (!line.trim()) return '';
    const [cmd, col, ...parts] = line.trim().split(' ');
    const rest = parts.join(' ').trim();

    switch (cmd) {
        case 'help':
            return HELP;

        case 'insert':
            return 'inserted ' + db.insert(col, json(rest))._id;

        case 'find': {
            const rows = db.find(col, json(rest));
            return [...rows.map((r) => JSON.stringify(r)), `(${rows.length} rows)`].join('\n');
        }

        case 'count':
            return String(db.count(col, json(rest)));

        case 'update': {
            const [query, patch] = rest.split('=>');
            if (!patch) throw new Error('Use:  update <col> <query> => <patch>');
            return `updated ${db.update(col, json(query.trim()), json(patch.trim()))}`;
        }

        case 'remove':
            return `removed ${db.remove(col, json(rest))}`;

        case 'seed':
            [
                { name: 'John', age: 20, city: 'London' },
                { name: 'Emma', age: 30, city: 'Paris' },
                { name: 'Liam', age: 17, city: 'London' },
                { name: 'Sophia', age: 25, city: 'Berlin' },
                { name: 'Lucas', age: 33, city: 'New York' },
            ].forEach((u) => db.insert('users', u));
            return 'seeded 5 users';

        case 'stats':
            return JSON.stringify(db.stats(), null, 2);

        case 'compact': {
            const before = db.stats().sizeBytes;
            db.compact();
            return `compacted: ${before} -> ${db.stats().sizeBytes} bytes`;
        }

        default:
            throw new Error(`Unknown command "${cmd}". Type help`);
    }
}