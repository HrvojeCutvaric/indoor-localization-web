export type ZonePoint = {
    x: number;
    y: number;
    ordinalNumber: number;
};

export type Zone = {
    id: string;
    mapId: string;
    name: string;
    points: ZonePoint[];
};

export type DraftPoint = { x: number; y: number };

export type ZoneValidationError =
    | 'NOT_ENOUGH_POINTS'
    | 'SELF_INTERSECTS';