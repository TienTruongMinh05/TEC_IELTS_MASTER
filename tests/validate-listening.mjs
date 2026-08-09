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

const indexHtml = readText('index.html');
const homeScript = readText('script.js');
const playerHtml = readText('tests/TEC_IELTS_Listening_Player.html');
const playerScript = readText('tests/listening-player.js');
assert.match(indexHtml, /firebase-app-compat\.js/);
assert.match(indexHtml, /firebase-auth-compat\.js/);
assert.match(indexHtml, /login-btn/);
assert.match(homeScript, /tec-ielts-master\.firebaseapp\.com/);
assert.match(homeScript, /signInWithPopup/);
assert.match(homeScript, /onAuthStateChanged/);
assert.doesNotMatch(homeScript, /supabaseClient|createSignedUrl/);
assert.match(playerHtml, /@supabase\/supabase-js@2\.112\.2/);
assert.match(playerHtml, /listening-player\.js/);
assert.match(playerScript, /getPublicUrl/);
assert.doesNotMatch(playerScript, /createSignedUrl|getSession|onAuthStateChange/);

const migrationDir = new URL('supabase/migrations/', root);
const publicMigrationFile = readdirSync(migrationDir).find(name => name.endsWith('_make_listening_storage_public.sql'));
assert.ok(publicMigrationFile, 'Public Listening Storage migration is missing');
const publicMigration = readFileSync(join(fileURLToPath(migrationDir), publicMigrationFile), 'utf8');
assert.match(publicMigration, /'ielts-listening'/);
assert.match(publicMigration, /52428800/);
assert.match(publicMigration, /\btrue\b/);
assert.match(publicMigration, /drop policy if exists "Authenticated users can listen to IELTS audio"/);

console.log('Listening validation passed: 7 tests, 28 public audio sections.');
