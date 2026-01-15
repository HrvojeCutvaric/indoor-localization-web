import type { DraftPoint, ZoneValidationError } from './zone.model';

type Segment = { a: DraftPoint; b: DraftPoint };

const EPS = 1e-9;

function orient(a: DraftPoint, b: DraftPoint, c: DraftPoint): number {
    // cross product (b-a) x (c-a)
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: DraftPoint, b: DraftPoint, p: DraftPoint): boolean {
    return (
        Math.min(a.x, b.x) - EPS <= p.x &&
        p.x <= Math.max(a.x, b.x) + EPS &&
        Math.min(a.y, b.y) - EPS <= p.y &&
        p.y <= Math.max(a.y, b.y) + EPS &&
        Math.abs(orient(a, b, p)) <= EPS
    );
}

function segmentsIntersect(s1: Segment, s2: Segment): boolean {
    const { a: p1, b: q1 } = s1;
    const { a: p2, b: q2 } = s2;

    const o1 = orient(p1, q1, p2);
    const o2 = orient(p1, q1, q2);
    const o3 = orient(p2, q2, p1);
    const o4 = orient(p2, q2, q1);

    // general case
    if ((o1 > EPS && o2 < -EPS || o1 < -EPS && o2 > EPS) &&
        (o3 > EPS && o4 < -EPS || o3 < -EPS && o4 > EPS)) {
        return true;
    }

    // collinear cases
    if (Math.abs(o1) <= EPS && onSegment(p1, q1, p2)) return true;
    if (Math.abs(o2) <= EPS && onSegment(p1, q1, q2)) return true;
    if (Math.abs(o3) <= EPS && onSegment(p2, q2, p1)) return true;
    if (Math.abs(o4) <= EPS && onSegment(p2, q2, q1)) return true;

    return false;
}

export function validatePolygon(points: DraftPoint[]): ZoneValidationError | null {
    if (!points || points.length < 3) return 'NOT_ENOUGH_POINTS';

    // build closed polygon segments
    const segs: Segment[] = [];
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        segs.push({ a, b });
    }

    // check self-intersections (ignore adjacent segments + first/last adjacency)
    for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
            const areAdjacent =
                j === i + 1 ||
                (i === 0 && j === segs.length - 1);

            if (areAdjacent) continue;

            if (segmentsIntersect(segs[i], segs[j])) {
                return 'SELF_INTERSECTS';
            }
        }
    }

    return null;
}