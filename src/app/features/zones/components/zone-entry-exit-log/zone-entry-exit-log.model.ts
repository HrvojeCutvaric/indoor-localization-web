/**
 * Zone Entry/Exit Log Models
 * Backend: AssetZoneHistory
 */

export type ZoneEventType = 'ENTRY' | 'EXIT';

export interface ZoneEntryExitLog {
    id: string;
    assetId: string;
    assetName?: string;
    zoneId: string;
    zoneName?: string;
    eventType: ZoneEventType;
    enterDateTime: string;
    exitDateTime?: string | null;
    retentionTime?: string | null;
}

export interface ZoneEntryExitLogFilters {
    assetId?: string;
    zoneId?: string;
    eventType?: ZoneEventType;
    dateRangeStart?: Date;
    dateRangeEnd?: Date;
}

export interface PaginationParams {
    pageNumber: number;
    pageSize: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Backend DTO for zone history
 */
export interface ZoneEntryExitLogResponse {
    id: number;
    assetId: number;
    zoneId: number;
    enterDateTime: string;
    exitDateTime: string | null;
    retentionTime: string | null;
}

/**
 * Asset info for enrichment
 */
export interface AssetInfo {
    id: number;
    name: string;
}

/**
 * Zone info for enrichment
 */
export interface ZoneInfo {
    id: number;
    name: string;
}
