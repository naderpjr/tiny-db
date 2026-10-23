# Tiny Database Engine with Node.js

A tiny document database written in plain Node.js. No dependencies, no build step, about 200 lines of code.

It exists to teach how real databases work. You can read the whole thing in one sitting and come away understanding append-only logs, checksums, crash recovery, and compaction.

## Features

- Stores JSON documents in named collections (like tables)
- Query operators: `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$in`
- Update with `$inc`
- Sort and limit
- Survives crashes: a half-written last line is detected and skipped
- Compaction to shrink the log file
- Interactive shell
- Tests with the built-in `node:test` runner

## Requirements

Node.js 18 or newer.

```bash
node -v
```

## Quick start

```bash
git clone https://github.com/naderpjr/tiny-db.git tiny-db
cd tiny-db
npm test      # run the tests
npm start     # open the interactive shell
```

## Project structure

```
tiny-db/
├── package.json
├── index.js        # starts the interactive shell
├── test.js         # tests
└── src/
    ├── log.js      # encode / decode one log line (with checksum)
    ├── query.js    # query matching and update patches
    ├── db.js       # the database engine
    └── shell.js    # turns text commands into database calls
```

Each file only depends on the ones above it in this list, so you can read them from the bottom of the stack up: `log.js`, then `query.js`, then `db.js`, then `shell.js`.

## Shell commands

Start the shell:

```bash
npm start
```

| Command | Example |
|---|---|
| `insert <col> <json>` | `insert users {"name":"John","age":20,"city":"London"}` |
| `find <col> [json]` | `find users {"age":{"$gt":18}}` |
| `count <col> [json]` | `count users {"city":"London"}` |
| `update <col> <query> => <patch>` | `update users {"name":"John"} => {"$inc":{"age":1}}` |
| `remove <col> <json>` | `remove users {"age":{"$lt":18}}` |
| `seed` | add 5 demo users |
| `stats` | file size, collections, log lines |
| `compact` | shrink the log file |
| `help` | list commands |
| `exit` | quit |

### Demo session

```
tinydb> seed
tinydb> find users
tinydb> find users {"age":{"$gt":18}}
tinydb> insert users {"name":"Olivia","age":28,"city":"Paris"}
tinydb> update users {"name":"John"} => {"$inc":{"age":1}}
tinydb> count users {"city":"London"}
tinydb> remove users {"age":{"$lt":18}}
tinydb> stats
tinydb> exit
```

## Using it as a library

```js
import { TinyDB } from './src/db.js';

const db = new TinyDB('my.db');

db.insert('users', { name: 'John', age: 20 });
db.find('users', { age: { $gt: 18 } }, { sort: { age: -1 }, limit: 10 });
db.update('users', { name: 'John' }, { $inc: { age: 1 } });
db.remove('users', { name: 'John' });
db.compact();
db.close();
```

## How it works

### The file is a log, not a table

The database file is an append-only log. Every change adds one line to the end. Nothing is ever edited in place.

```
70bd3bb1 {"type":"put","col":"users","id":"e2f5","doc":{"name":"John","age":20}}
809eb6af {"type":"put","col":"users","id":"e2f5","doc":{"name":"John","age":21}}
70681d42 {"type":"del","col":"users","id":"697e"}
```

Each line has two parts:

1. An 8-character **checksum** of the JSON
2. The **JSON operation**: `put` (save a document) or `del` (delete one)

Think of it as an accounting ledger. You never erase a line. You add a new one, and the current balance is whatever you get by reading from the top.

### The four ideas

**1. Append-only log.** Every `insert`, `update`, and `remove` writes one line to the end of the file. Appending is fast and simple, and old data is never corrupted by a new write.

**2. Checksum.** If the power dies in the middle of a write, the last line may be cut off. On startup, each line's checksum is recomputed. A line that does not match is skipped. The rest of the database loads normally.

**3. Replay.** On startup the file is read from top to bottom and each operation is applied to in-memory `Map`s. This rebuilds the current state. For any document id, **the last line wins**.

**4. Compaction.** The log grows with every update. `compact` writes a new file containing only the live documents, then swaps it in with an atomic `rename`. At no point is there a half-written main file.

### The write path

For every change, the order is:

1. Append the line(s) to the file
2. `fsync` to force the data onto the disk
3. Apply the change to memory

The disk is written before memory, so anything the database reported as successful is safe on disk.

### Is this a real design?

Yes. It is called log-structured storage. Similar ideas are used in:

- **Bitcask** (Riak's storage engine)
- **Redis** AOF persistence
- **Kafka**
- **LSM-trees** (LevelDB, RocksDB, Cassandra)

Databases like PostgreSQL and SQLite keep a separate data file and a separate write-ahead log. Here the log is the data, which keeps the code small.

## Tests

```bash
npm test
```

The tests cover insert, find, operators, sort, limit, update, remove, duplicate ids, reopening the database, recovery from a half-written line, and compaction.

### Simulate a crash

```bash
printf 'deadbeef {"type":"put","col":"users","id":"zz","doc":{"_i' >> demo.db
npm start
```

The shell reports one corrupt line skipped and all other data is intact.

## Limitations

This is a teaching project, not a production database.

- Only one process should open a file at a time (no file locking)
- All data must fit in RAM
- Every query scans the whole collection (no indexes)
- Equality works only for simple values (numbers and strings)
- No transactions across multiple operations

## Ideas for next steps

- Add indexes (a `Map` from field value to document ids) and compare speed with a full scan
- Add `$or` and `$and`
- Add file locking
- Expose the database over HTTP with `node:http`
- Replace the in-memory index with a B-tree for range queries

## License

MIT