export interface Asset {
    id: number;
    name: string;
    x: number;
    y: number;
    floorMapId: number;
    active: boolean;
    color: string;
    lastSync?: string;
}

export interface CreateAssetRequest {
    name: string;
    x: number;
    y: number;
    floorMapId: number;
    active: boolean;
    color: string;
}

export interface UpdateAssetRequest {
    name: string;
    color: string;
}