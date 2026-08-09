import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const readText = path => readFileSync(new URL(path, root), 'utf8');
const readJson = path => JSON.parse(readText(path));

execFileSync(process.execPath, ['--check', fileURLToPath(new URL('script.js', root))]);
execFileSync(process.execPath, ['--check', fileURLToPath(new URL('tests/listening-player.js', root))]);

const tasks = readJson('task_list.json');
const manifest = readJson('listening_manifest.json');
const listeningTasks = tasks.filter(task => /^L[1-7]$/.test(task.id));

assert.equal(manifest.version, 1, 'Unexpected manifest version');
assert.equal(manifest.bucket, 'ielts-listening', 'Unexpected Storage bucket');
assert.equal(listeningTasks.length, 7, 'Catalog must contain L1-L7');
assert.equal(manifest.tests.length, 7, 'Manifest must contain L1-L7');

const seenPaths = new Set();
for (let testNumber = 1; testNumber <= 7; testNumber += 1) {
    const id = `L${testNumber}`;
    const task = listeningTasks.find(item => item.id === id);
    const manifestTest = manifest.tests.find(item => item.id === id);

    assert.ok(task, `Missing task ${id}`);
    assert.ok(manifestTest, `Missing manifest test ${id}`);
    assert.equal(task.url, `tests/TEC_IELTS_Listening_Player.html?test=${id}`);
    assert.equal(task.available, manifestTest.available, `Availability mismatch for ${id}`);
    assert.equal(manifestTest.sections.length, 4, `${id} must have four sections`);

    manifestTest.sections.forEach((section, index) => {
        const sectionNumber = index + 1;
        const expectedPath = `tests/L0${testNumber}/section-0${sectionNumber}.mp3`;
        assert.equal(section.number, sectionNumber, `${id} section number mismatch`);
        assert.equal(section.objectPath, expectedPath, `${id} object path mismatch`);
        assert.ok(!seenPaths.has(section.objectPath), `Duplicate object path ${section.objectPath}`);
        seenPaths.add(section.objectPath);
    });
}

assert.equal(seenPaths.size, 28, 'Expected 28 unique section paths');

const playerHtml = readText('tests/TEC_IELTS_Listening_Player.html');
assert.match(playerHtml, /@supabase\/supabase-js@2\.112\.2/);
assert.match(playerHtml, /listening-player\.js/);

const migrationDir = new URL('supabase/migrations/', root);
const migrationFile = readdirSync(migrationDir).find(name => name.endsWith('_create_listening_storage.sql'));
assert.ok(migrationFile, 'Listening Storage migration is missing');
const migration = readFileSync(join(fileURLToPath(migrationDir), migrationFile), 'utf8');
assert.match(migration, /'ielts-listening'/);
assert.match(migration, /52428800/);
assert.match(migration, /to authenticated/);
assert.match(migration, /bucket_id = 'ielts-listening'/);

console.log('Listening validation passed: 7 tests, 28 private audio sections.');
