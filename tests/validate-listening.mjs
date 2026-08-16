import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const readText = path => readFileSync(new URL(path, root), 'utf8');
const readJson = path => JSON.parse(readText(path));

execFileSync(process.execPath, ['--check', fileURLToPath(new URL('script.js', root))]);
execFileSync(process.execPath, ['--check', fileURLToPath(new URL('tests/listening-storage.js', root))]);

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
    const expectedPage = `tests/TEC_IELTS_Listening_Mock_Test_${testNumber}.html`;
    const task = listeningTasks.find(item => item.id === id);
    const manifestTest = manifest.tests.find(item => item.id === id);
    const page = readText(expectedPage);

    assert.ok(task, `Missing task ${id}`);
    assert.ok(manifestTest, `Missing manifest test ${id}`);
    assert.equal(task.url, expectedPage);
    assert.equal(task.available, true, `${id} must be available in catalog`);
    assert.equal(manifestTest.available, true, `${id} must be available in manifest`);
    assert.equal(manifestTest.sections.length, 4, `${id} must have four sections`);

    assert.match(page, new RegExp(`<title>TEC IELTS Listening Mock Test ${testNumber}</title>`));
    assert.match(page, /\.\.\/supabase-config\.js/);
    assert.match(page, /listening-storage\.js/);
    assert.match(page, /TEC_LISTENING_AUDIO\.publicUrl\(s\.objectPath\)/);
    assert.equal((page.match(/data-q=\\"\d+\\"/g) || []).length, 40, `${id} must render 40 answers`);
    assert.equal((page.match(/"objectPath"\s*:/g) || []).length, 4, `${id} must contain four object paths`);
    assert.doesNotMatch(page, /data:audio|"audio"\s*:/, `${id} still embeds audio`);

    manifestTest.sections.forEach((section, index) => {
        const sectionNumber = index + 1;
        const expectedPath = `tests/L0${testNumber}/section-0${sectionNumber}.mp3`;
        assert.equal(section.number, sectionNumber, `${id} section number mismatch`);
        assert.equal(section.objectPath, expectedPath, `${id} object path mismatch`);
        assert.ok(page.includes(expectedPath), `${id} page is missing ${expectedPath}`);
        assert.ok(!seenPaths.has(section.objectPath), `Duplicate object path ${section.objectPath}`);
        seenPaths.add(section.objectPath);
    });
}

assert.equal(seenPaths.size, 28, 'Expected 28 unique section paths');

const indexHtml = readText('index.html');
const homeScript = readText('script.js');
const legacyPlayer = readText('tests/TEC_IELTS_Listening_Player.html');
const storageHelper = readText('tests/listening-storage.js');
assert.match(indexHtml, /firebase-app-compat\.js/);
assert.match(indexHtml, /firebase-auth-compat\.js/);
assert.match(indexHtml, /login-btn/);
assert.match(homeScript, /tec-ielts-master\.firebaseapp\.com/);
assert.match(homeScript, /signInWithPopup/);
assert.match(homeScript, /onAuthStateChanged/);
assert.doesNotMatch(homeScript, /supabaseClient|createSignedUrl/);
assert.match(legacyPlayer, /window\.location\.replace/);
assert.match(storageHelper, /storage\/v1\/object\/public/);
assert.doesNotMatch(storageHelper, /service_role|sb_secret_/);

const migrationDir = new URL('supabase/migrations/', root);
const publicMigrationFile = readdirSync(migrationDir).find(name => name.endsWith('_make_listening_storage_public.sql'));
assert.ok(publicMigrationFile, 'Public Listening Storage migration is missing');
const publicMigration = readFileSync(join(fileURLToPath(migrationDir), publicMigrationFile), 'utf8');
assert.match(publicMigration, /'ielts-listening'/);
assert.match(publicMigration, /52428800/);
assert.match(publicMigration, /\btrue\b/);
assert.match(publicMigration, /drop policy if exists "Authenticated users can listen to IELTS audio"/);

console.log('Listening validation passed: 7 full tests, 280 questions, 28 public audio sections.');
