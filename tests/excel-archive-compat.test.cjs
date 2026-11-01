'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const fromExcel = createRequire(require.resolve('exceljs'));
const archiver = fromExcel('archiver');
const unzipper = fromExcel('unzipper');
const fromArchiver = createRequire(fromExcel.resolve('archiver'));
const archiveFileUtils = fromArchiver('archiver-utils/file');

async function verifyArchive(useGlob) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beverly-archive-check-'));
  const txt = path.join(dir, 'included.txt');
  const bin = path.join(dir, 'excluded.bin');
  fs.writeFileSync(txt, 'test content');
  fs.writeFileSync(bin, 'other content');
  try {
    assert.deepEqual(archiveFileUtils.expand({ cwd: dir }, ['*.txt', '!excluded*']), ['included.txt']);
    const chunks = [];
    const zip = archiver('zip');
    zip.on('data', chunk => chunks.push(chunk));
    const done = new Promise((resolve, reject) => { zip.on('end', resolve); zip.on('error', reject); });
    if (useGlob) zip.glob('*.txt', { cwd: dir });
    else zip.directory(dir, false);
    await zip.finalize();
    await done;
    const archive = await unzipper.Open.buffer(Buffer.concat(chunks));
    const names = archive.files.map(file => file.path).sort();
    assert.deepEqual(names, useGlob ? ['included.txt'] : ['excluded.bin', 'included.txt']);
    const file = archive.files.find(entry => entry.path === 'included.txt');
    assert.equal((await file.buffer()).toString(), 'test content');
  } finally {
    fs.unlinkSync(txt);
    fs.unlinkSync(bin);
    fs.rmdirSync(dir);
  }
}

(async () => { await verifyArchive(true); await verifyArchive(false); console.log('Excel archive compatibility passed'); })()
  .catch(error => { console.error(error); process.exitCode = 1; });
