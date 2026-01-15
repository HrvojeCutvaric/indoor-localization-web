export type ZonePoint = {
    x: number;
    y: number;
    ordinalNumber: number;
};

export type Point = {
    x: number;
    y: number;
};

export type Polygon = {
    id: string;
    points: Point[];
    color?: string;
    createdAt?: number;
    name?: string;
};

export type Zone = {
    id: string;
    mapId: string;
    name: string;
    points: ZonePoint[];
    description?: string;
    polygons: Polygon[];
    createdAt?: number;
    floorMapId: string;
};

export type DraftPoint = { x: number; y: number };

export type ZoneValidationError =
    | 'NOT_ENOUGH_POINTS'
    | 'SELF_INTERSECTS';