import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TinyDB } from './src/db.js';

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tinydb-')), 'test.db');
let db = new TinyDB(file);

test('insert and find', () => {
    db.insert('users', { name: 'Ali', age: 20, city: 'Kabul' });
    const rows = db.find('users', { name: 'Ali' });
    assert.equal(rows.length, 1);
    assert.ok(rows[0]._id);
});

test('operators: $gt and $in', () => {
    db.insert('users', { name: 'Sara', age: 30, city: 'Herat' });
    db.insert('users', { name: 'Omid', age: 17, city: 'Kabul' });
    db.insert('users', { name: 'Nina', age: 25, city: 'Berlin' });
    assert.equal(db.count('users', { age: { $gt: 18 } }), 3);
    assert.equal(db.count('users', { city: { $in: ['Kabul', 'Herat'] } }), 3);
});

test('sort and limit', () => {
    const top = db.find('users', {}, { sort: { age: -1 }, limit: 2 });
    assert.deepEqual(top.map((u) => u.name), ['Sara', 'Nina']);
});

test('update with $inc', () => {
    assert.equal(db.update('users', { name: 'Ali' }, { $inc: { age: 1 } }), 1);
    assert.equal(db.find('users', { name: 'Ali' })[0].age, 21);
});

test('remove', () => {
    assert.equal(db.remove('users', { age: { $lt: 18 } }), 1);
    assert.equal(db.count('users'), 3);
});

test('duplicate _id is rejected', () => {
    assert.throws(() => db.insert('users', { _id: 'same' }) && db.insert('users', { _id: 'same' }), /Duplicate/);
    db.remove('users', { _id: 'same' });
});

test('data survives close and reopen', () => {
    db.close();
    db = new TinyDB(file);
    assert.equal(db.count('users'), 3);
    assert.equal(db.find('users', { name: 'Ali' })[0].age, 21);
});

test('crash: broken last line is skipped', () => {
    db.close();
    fs.appendFileSync(file, 'deadbeef {"type":"put","col":"users","id":"x","doc":{"_i');
    db = new TinyDB(file);
    assert.equal(db.skipped, 1);
    assert.equal(db.count('users'), 3);
    db.insert('users', { name: 'After' });
    db.close();
    db = new TinyDB(file);
    assert.equal(db.count('users'), 4);
});

test('compact makes the file smaller and keeps data', () => {
    for (let i = 0; i < 200; i++) db.update('users', { name: 'Ali' }, { $inc: { age: 1 } });
    const before = db.stats().sizeBytes;
    db.compact();
    assert.ok(db.stats().sizeBytes < before / 2);
    assert.equal(db.count('users'), 4);
    db.close();
    db = new TinyDB(file);
    assert.equal(db.count('users'), 4);
});

test.after(() => db.close());