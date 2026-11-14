import type { Basket } from '../../finance/categories';

export const SORT_DURATION = 6200;
export type Point = { x: number; y: number; z: number };
type Pose = Point & { angle: number };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => { const v = clamp(t); return v * v * (3 - 2 * v); };
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
const add = (a: Point, b: Point, k = 1): Point => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const unit = (p: Point): Point => { const length = Math.hypot(p.x, p.y, p.z) || 1; return { x: p.x / length, y: p.y / length, z: p.z / length }; };
const at = (x: number, y: number, z = 0, angle = 0): Pose => ({ x, y, z, angle });
export const LEFT_SHOULDER = at(240, 173);
export const RIGHT_SHOULDER = at(355, 173);
export const UPPER_ARM = 105;
export const FOREARM = 108;

/** Fixed-length bones in depth: a forearm turns towards the viewer instead of stretching. */
export function elbowFor(shoulder: Point, wrist: Point, left: boolean): Point {
  const delta = add(wrist, shoulder, -1);
  const distance = Math.hypot(delta.x, delta.y, delta.z);
  const axis = unit(delta);
  const along = (UPPER_ARM ** 2 - FOREARM ** 2 + distance ** 2) / (2 * distance);
  const radius = Math.sqrt(Math.max(0, UPPER_ARM ** 2 - along ** 2));
  // The presenting elbow stays beside the torso; the reaching elbow opens outwards.
  const pole = { x: left ? -1 : mix(-1, 3, ease((wrist.x - 430) / 30)), y: 2, z: 0 };
  const bend = unit(add(pole, axis, -dot(pole, axis)));
  return add(add(shoulder, axis, along), bend, radius);
}

export function rotate(x: number, y: number, angle: number) {
  const a = angle * Math.PI / 180;
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
}
const local = (pose: Pose, x: number, y: number) => { const d = rotate(x, y, pose.angle); return { x: pose.x + d.x, y: pose.y + d.y }; };

function poseAt(p: number, keys: [number, Pose][]): Pose {
  const next = keys.findIndex(([time]) => time >= p);
  if (next <= 0) return keys[next === 0 ? 0 : keys.length - 1][1];
  const [start, a] = keys[next - 1];
  const [end, b] = keys[next];
  const t = ease((p - start) / (end - start));
  return at(mix(a.x, b.x, t), mix(a.y, b.y, t), mix(a.z, b.z, t), mix(a.angle, b.angle, t));
}

const leftRest = at(185, 242, 65, -22);
const rightRest = at(418, 229, 45, -12);
const present = at(335, 264, 75, 35);
const sourceGrip = local(present, 3, -78);
const pinchOffset = rotate(36, 25, -18);
const pickup = at(sourceGrip.x - pinchOffset.x, sourceGrip.y - pinchOffset.y, 90, -18);

/** One receipt: present -> pinch -> carry -> open fingers -> fall -> return. */
export function sortingFrame(basket: Basket, p: number) {
  const isLeft = basket === 'regular';
  const release = isLeft ? .62 : .70;
  const endDrop = isLeft ? .85 : .9;
  const leftDrop = at(145, 260, 50, -30);
  const targetAngle = basket === 'irregular' ? -55 : -10;
  const offset = rotate(36, 25, targetAngle);
  const destination = at((basket === 'irregular' ? 350 : 500) - offset.x, 248 - offset.y, basket === 'irregular' ? 70 : 35, targetAngle);
  const left = poseAt(p, isLeft
    ? [[0, leftRest], [.12, leftRest], [.40, leftDrop], [.80, leftDrop], [1, leftRest]]
    : [[0, leftRest], [.04, leftRest], [.19, present], [.29, present], [.48, leftRest], [1, leftRest]]);
  const right = poseAt(p, isLeft ? [[0, rightRest], [1, rightRest]] : [
    [0, rightRest], [.06, rightRest], [.19, pickup], [.27, pickup],
    [.43, at(mix(pickup.x, destination.x, .55), Math.min(pickup.y, destination.y) + 8, 75, mix(-18, targetAngle, .5))],
    [.60, destination], [.80, destination], [1, rightRest],
  ]);
  const leftOpen = isLeft ? ease((p - .56) / .10) * (1 - ease((p - .85) / .12)) : 0;
  const rightOpen = isLeft ? 1 : p < .27 ? 1 - ease((p - .19) / .07) : ease((p - .66) / .08);
  let paperAngle: number;
  let paper: { x: number; y: number };
  if (isLeft || p <= .27) {
    const hand = isLeft && p > release ? leftDrop : left;
    paperAngle = hand.angle;
    paper = local(hand, 3, -54);
  } else {
    const hand = p > release ? destination : right;
    const grip = local(hand, 36, 25);
    paperAngle = mix(present.angle, basket === 'irregular' ? 5 : -7, ease((Math.min(p, release) - .27) / .33));
    const belowGrip = rotate(0, 24, paperAngle);
    paper = { x: grip.x + belowGrip.x, y: grip.y + belowGrip.y };
  }
  if (p > release) {
    const fall = clamp((p - release) / (endDrop - release));
    paper.y += (isLeft ? 220 : 145) * fall * fall;
    paper.x += Math.sin(fall * Math.PI) * 3;
    paperAngle = mix(paperAngle, 3, fall);
  }
  return {
    left, right, leftElbow: elbowFor(LEFT_SHOULDER, left, true), rightElbow: elbowFor(RIGHT_SHOULDER, right, false),
    leftOpen, rightOpen, paperX: paper.x, paperY: paper.y, paperAngle,
    paperOpacity: p < endDrop ? 1 : 1 - clamp((p - endDrop) / .025),
  };
}

const xy = (p: { x: number; y: number }) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
const planar = (a: Point, b: Point) => unit({ x: b.x - a.x, y: b.y - a.y, z: 0 });
const normal = (p: Point): Point => ({ x: -p.y, y: p.x, z: 0 });

function roundedOutline(points: Point[], radii: number[]) {
  const corners = points.map((point, i) => {
    const previous = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const before = Math.hypot(previous.x - point.x, previous.y - point.y);
    const after = Math.hypot(next.x - point.x, next.y - point.y);
    const cut = Math.min(radii[i], before * .4, after * .4);
    return { point, enter: add(point, planar(point, previous), cut), exit: add(point, planar(point, next), cut) };
  });
  return corners.map((corner, i) => `${i ? 'L' : 'M'}${xy(corner.enter)} Q${xy(corner.point)} ${xy(corner.exit)}`).join(' ') + 'Z';
}

/** Two tapered sleeve sections and a rounded elbow; the cuff follows the wrist. */
export function sleevePath(shoulder: Point, elbow: Point, wrist: Pose, left: boolean) {
  const upper = planar(shoulder, elbow);
  const lower = planar(elbow, wrist);
  const n1 = normal(upper);
  const n2 = normal(lower);
  const axis2d = rotate(1, 0, wrist.angle + (left ? -90 : 0));
  const cuffAxis = { ...axis2d, z: 0 };
  const cuffNormal = normal(cuffAxis);
  const rootA = add(shoulder, n1, 23), rootB = add(shoulder, n1, -23);
  const round = unit(add(n1, n2));
  const innerLength = Math.min(46, 18 / Math.max(.2, dot(round, n1)));
  const plusIsInner = upper.x * lower.y - upper.y * lower.x > 0;
  const elbowA = add(elbow, round, plusIsInner ? innerLength : 25);
  const elbowB = add(elbow, round, plusIsInner ? -25 : -innerLength);
  const cuffA = add(wrist, cuffNormal, 11), cuffB = add(wrist, cuffNormal, -11);
  const path = roundedOutline([rootA, elbowA, cuffA, cuffB, elbowB, rootB], [12, plusIsInner ? 5 : 22, 2, 2, plusIsInner ? 22 : 5, 12]);
  const band = `M${xy(add(add(wrist, cuffAxis, -9), cuffNormal, 13))} L${xy(add(add(wrist, cuffAxis, 2), cuffNormal, 11))} L${xy(add(add(wrist, cuffAxis, 2), cuffNormal, -11))} L${xy(add(add(wrist, cuffAxis, -9), cuffNormal, -13))}Z`;
  const crease = `M${xy(add(elbow, n2, -10))} Q${xy(add(elbow, lower, 9))} ${xy(add(add(elbow, lower, 17), n2, -8))}`;
  return { path, band, crease };
}

export function motionFrames(basket: Basket) {
  return Array.from({ length: 151 }, (_, i) => {
    const t = i / 150;
    const frame = sortingFrame(basket, t);
    return { t, ...frame, leftSleeve: sleevePath(LEFT_SHOULDER, frame.leftElbow, frame.left, true), rightSleeve: sleevePath(RIGHT_SHOULDER, frame.rightElbow, frame.right, false) };
  });
}
