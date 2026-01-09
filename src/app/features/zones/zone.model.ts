export interface Point {
  x: number;
  y: number;
}

export interface Polygon {
  id: string;
  points: Point[];
  name?: string;
  color?: string;
  createdAt: number;
}

export interface Zone {
  id: string;
  name: string;
  description?: string;
  floorMapId: string;
  polygons: Polygon[];
  createdAt: number;
}
