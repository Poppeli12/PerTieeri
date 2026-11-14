// Fixed-length arms, paper attachment and landing. No network or AI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const motion = require('../src/components/buckets/sortingMotion.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
for (const [index, basket] of ['regular', 'irregular', 'slipping'].entries()) {
  const frames = motion.motionFrames(basket);
  for (const frame of frames) {
    for (const side of ['left', 'right']) {
      const shoulder = side === 'left' ? motion.LEFT_SHOULDER : motion.RIGHT_SHOULDER;
      const elbow = frame[`${side}Elbow`];
      const wrist = frame[side];
      assert.ok(Math.abs(distance(shoulder, elbow) - motion.UPPER_ARM) < 1e-6, 'Upper arm does not stretch');
      assert.ok(Math.abs(distance(elbow, wrist) - motion.FOREARM) < 1e-6, 'Forearm does not stretch');
      assert.ok(!/NaN|Infinity/.test(frame[`${side}Sleeve`].path));
    }
    if (frame.paperY >= 330 && frame.paperOpacity > 0) {
      assert.ok(frame.paperX - 22 > index * 200 + 14 && frame.paperX + 22 < index * 200 + 186, 'Receipt fits inside the selected opening');
    }
    if (basket !== 'regular' && frame.t > .27 && frame.t <= .70) {
      const grip = motion.rotate(36, 25, frame.right.angle);
      const paperGrip = motion.rotate(0, -24, frame.paperAngle);
      assert.ok(Math.hypot(frame.right.x + grip.x - frame.paperX - paperGrip.x, frame.right.y + grip.y - frame.paperY - paperGrip.y) < 1e-6, 'Held receipt stays between thumb and index');
    }
  }
  if (basket !== 'regular') {
    const before = motion.sortingFrame(basket, .27 - 1e-7);
    const after = motion.sortingFrame(basket, .27 + 1e-7);
    assert.ok(Math.hypot(before.paperX - after.paperX, before.paperY - after.paperY) < .001, 'No jump when changing hands');
  }
  const release = basket === 'regular' ? .62 : .70;
  const a = motion.sortingFrame(basket, release), b = motion.sortingFrame(basket, release + .05), c = motion.sortingFrame(basket, release + .1);
  assert.ok(b.paperY > a.paperY && c.paperY - b.paperY > b.paperY - a.paperY, 'Receipt accelerates after release');
  const first = frames[0], last = frames.at(-1);
  assert.equal(distance(first.left, last.left), 0);
  assert.equal(distance(first.right, last.right), 0);
  assert.equal(last.paperOpacity, 0, 'Receipt is hidden inside the bucket before next cycle');
  console.log(`PASS ${basket}: anatomy, grip, handover, release, bucket and return`);
}
