import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePoll, normalizeStatusHost, toStatus, FETCH_FAILURE_THRESHOLD } from '../src/modules/outages/alerting.js';

const ok = (indicator) => ({ indicator, fetchFailed: false });
const failed = { fetchFailed: true };

/** Runs a sequence of poll results through evaluatePoll, returning each notify. */
function run(results, start = { lastStatus: 'up', alerting: 0, failCount: 0 }) {
  let row = { ...start };
  const notes = [];
  for (const r of results) {
    const d = evaluatePoll(row, r);
    notes.push(d.notify);
    row = { lastStatus: d.status ?? row.lastStatus, alerting: d.alerting ? 1 : 0, failCount: d.failCount };
  }
  return notes;
}

test('toStatus maps Statuspage indicators', () => {
  assert.equal(toStatus('none'), 'up');
  assert.equal(toStatus('minor'), 'degraded');
  assert.equal(toStatus('major'), 'down');
  assert.equal(toStatus('critical'), 'down');
});

test('plain up -> down -> up alerts once each way', () => {
  assert.deepEqual(run([ok('major'), ok('major'), ok('none')]), ['down', null, 'recovered']);
});

test('up -> degraded -> down still alerts (regression: used to be silent)', () => {
  assert.deepEqual(run([ok('minor'), ok('major')]), [null, 'down']);
});

test('down -> degraded -> up still posts the recovery (regression)', () => {
  assert.deepEqual(run([ok('major'), ok('minor'), ok('none')]), ['down', null, 'recovered']);
});

test('degraded with no open incident never posts a recovery', () => {
  assert.deepEqual(run([ok('minor'), ok('none')]), [null, null]);
});

test('first-ever check never alerts, even if down', () => {
  assert.deepEqual(run([ok('major')], { lastStatus: null, alerting: 0, failCount: 0 }), [null]);
});

test('a single failed fetch keeps the last status and does not page', () => {
  const d = evaluatePoll({ lastStatus: 'up', alerting: 0, failCount: 0 }, failed);
  assert.equal(d.status, null);
  assert.equal(d.notify, null);
  assert.equal(d.failCount, 1);
});

test(`${FETCH_FAILURE_THRESHOLD} consecutive fetch failures count as down`, () => {
  const seq = Array(FETCH_FAILURE_THRESHOLD).fill(failed);
  const notes = run(seq);
  assert.equal(notes.at(-1), 'down');
  assert.ok(notes.slice(0, -1).every((n) => n === null));
});

test('a success resets the failure streak', () => {
  assert.deepEqual(run([failed, failed, ok('none'), failed, failed]), [null, null, null, null, null]);
});

test('normalizeStatusHost accepts hosts and pasted URLs', () => {
  assert.equal(normalizeStatusHost('status.example.com'), 'status.example.com');
  assert.equal(normalizeStatusHost('https://Status.Example.com/history?x=1'), 'status.example.com');
  assert.equal(normalizeStatusHost('  www.githubstatus.com/  '), 'www.githubstatus.com');
});

test('normalizeStatusHost rejects non-public or malformed targets', () => {
  for (const bad of ['', 'localhost', '127.0.0.1', '169.254.169.254', 'foo', 'svc.internal', 'printer.local', 'a'.repeat(80) + '.com', 'exa mple.com']) {
    assert.equal(normalizeStatusHost(bad), null, bad);
  }
});
