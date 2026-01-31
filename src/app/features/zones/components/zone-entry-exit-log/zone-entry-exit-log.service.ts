import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, timer, of, forkJoin } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import {
    ZoneEntryExitLog,
    ZoneEntryExitLogFilters,
    PaginationParams,
    PaginatedResponse,
    ZoneEntryExitLogResponse,
    AssetInfo,
    ZoneInfo,
} from './zone-entry-exit-log.model';

@Injectable({
    providedIn: 'root',
})
export class ZoneEntryExitLogService implements OnDestroy {
    private readonly assetApiUrl = '/api/Asset';
    private readonly zoneApiUrl = '/api/Zone';
    private readonly pollIntervalMs = 5000;

    // State subjects
    private logsSubject = new BehaviorSubject<ZoneEntryExitLog[]>([]);
    private filteredLogsSubject = new BehaviorSubject<ZoneEntryExitLog[]>([]);
    private paginatedLogsSubject = new BehaviorSubject<PaginatedResponse<ZoneEntryExitLog>>({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 20,
        totalPages: 0,
    });
    private loadingSubject = new BehaviorSubject<boolean>(false);
    private errorSubject = new BehaviorSubject<string | null>(null);
    private filtersSubject = new BehaviorSubject<ZoneEntryExitLogFilters>({});
    private paginationSubject = new BehaviorSubject<PaginationParams>({
        pageNumber: 1,
        pageSize: 20,
    });

    // Caches for enrichment
    private assetCache = new Map<string, AssetInfo>();
    private zoneCache = new Map<string, ZoneInfo>();

    // Public observables
    logs$ = this.logsSubject.asObservable();
    filteredLogs$ = this.filteredLogsSubject.asObservable();
    paginatedLogs$ = this.paginatedLogsSubject.asObservable();
    loading$ = this.loadingSubject.asObservable();
    error$ = this.errorSubject.asObservable();
    filters$ = this.filtersSubject.asObservable();
    pagination$ = this.paginationSubject.asObservable();

    // Polling state
    private pollingSubscription: Subscription | null = null;
    private floorMapId: string | null = null;

    constructor(private http: HttpClient) {}

    ngOnDestroy(): void {
        this.stopPolling();
    }

    /**
     * Initialize logs for a floor map with optional polling
     */
    initializeLogs(floorMapId: string, enablePolling = true): void {
        this.floorMapId = floorMapId;
        this.errorSubject.next(null);
        this.resetFilters();
        this.resetPagination();

        // Fetch reference data first, then load logs
        forkJoin([
            this.fetchAndCacheAssets(floorMapId),
            this.fetchAndCacheZones(floorMapId),
        ]).subscribe({
            next: () => {
                this.loadLogs();
                if (enablePolling) {
                    this.startPolling();
                }
            },
            error: () => {
                // Continue even if enrichment fails
                this.loadLogs();
                if (enablePolling) {
                    this.startPolling();
                }
            },
        });
    }

    /**
     * Load logs based on current filters and pagination
     */
    loadLogs(): void {
        if (!this.floorMapId) {
            this.errorSubject.next('Floor map ID not set');
            return;
        }

        this.loadingSubject.next(true);
        this.errorSubject.next(null);
        console.log('Loading logs for floor map:', this.floorMapId);

        // Get all assets for this floor map
        this.http
            .get<any>(`${this.assetApiUrl}/floormap/${this.floorMapId}`)
            .pipe(
                tap((response) => {
                    console.log('Assets API response:', response);
                }),
                switchMap((response) => {
                    const assets = response.data || response;
                    console.log('Extracted assets:', assets);
                    if (!Array.isArray(assets) || assets.length === 0) {
                        console.log('No assets found, returning empty');
                        return of([]);
                    }

                    console.log('Fetching history for', assets.length, 'assets');
                    // Get zone history for all assets
                    const historyRequests = assets.map((asset) =>
                        this.http
                            .get<any>(`${this.assetApiUrl}/${asset.id}/history/zones`)
                            .pipe(
                                map((historyResponse) => {
                                    const historyData = historyResponse.data || historyResponse;
                                    return Array.isArray(historyData) ? historyData : [];
                                }),
                                catchError((err) => {
                                    console.warn('Failed to fetch history for asset', asset.id, err);
                                    return of([]);
                                })
                            )
                    );

                    return forkJoin(historyRequests).pipe(map((results) => results.flat()));
                }),
                map((responses) => {
                    console.log('Transforming', responses.length, 'log responses');
                    return this.transformAndEnrichLogs(responses);
                }),
                tap((logs) => {
                    console.log('Logs loaded successfully:', logs.length, 'logs');
                    this.logsSubject.next(logs);
                    this.applyFiltersAndPagination();
                    this.loadingSubject.next(false);
                }),
                catchError((error: HttpErrorResponse) => {
                    console.error('Error loading logs:', error);
                    const errorMessage = this.extractErrorMessage(error);
                    this.errorSubject.next(errorMessage);
                    this.loadingSubject.next(false);
                    return of([]);
                })
            )
            .subscribe();
    }

    /**
     * Start periodic polling for updates
     */
    startPolling(): void {
        if (this.pollingSubscription) {
            return;
        }

        this.pollingSubscription = timer(this.pollIntervalMs, this.pollIntervalMs)
            .pipe(
                switchMap(() => {
                    if (!this.floorMapId) {
                        return of([]);
                    }

                    return this.http
                        .get<any>(`${this.assetApiUrl}/floormap/${this.floorMapId}`)
                        .pipe(
                            switchMap((response) => {
                                const assets = response.data || response;
                                if (!Array.isArray(assets) || assets.length === 0) {
                                    return of([]);
                                }

                                const historyRequests = assets.map((asset) =>
                                    this.http
                                        .get<any>(`${this.assetApiUrl}/${asset.id}/history/zones`)
                                        .pipe(
                                            map((historyResponse) => {
                                                const historyData = historyResponse.data || historyResponse;
                                                return Array.isArray(historyData) ? historyData : [];
                                            }),
                                            catchError(() => of([]))
                                        )
                                );

                                return forkJoin(historyRequests).pipe(map((results) => results.flat()));
                            }),
                            catchError(() => of([]))
                        );
                }),
                map((responses) => this.transformAndEnrichLogs(responses)),
                tap((logs) => {
                    if (logs.length > 0 || this.logsSubject.value.length > 0) {
                        this.logsSubject.next(logs);
                        this.applyFiltersAndPagination();
                    }
                })
            )
            .subscribe({
                error: (err) => console.error('Polling error:', err),
            });
    }

    /**
     * Stop polling
     */
    stopPolling(): void {
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = null;
        }
    }

    /**
     * Set filters and reapply
     */
    setFilters(filters: ZoneEntryExitLogFilters): void {
        this.filtersSubject.next(filters);
        this.paginationSubject.next({ ...this.paginationSubject.value, pageNumber: 1 });
        this.applyFiltersAndPagination();
    }

    /**
     * Reset filters to empty state
     */
    resetFilters(): void {
        this.filtersSubject.next({});
    }

    /**
     * Set pagination params
     */
    setPagination(params: PaginationParams): void {
        this.paginationSubject.next(params);
        this.applyFiltersAndPagination();
    }

    /**
     * Go to specific page
     */
    goToPage(pageNumber: number): void {
        const current = this.paginationSubject.value;
        const totalPages = this.paginatedLogsSubject.value.totalPages;

        if (pageNumber >= 1 && pageNumber <= totalPages) {
            this.paginationSubject.next({ ...current, pageNumber });
            this.applyFiltersAndPagination();
        }
    }

    /**
     * Next page
     */
    nextPage(): void {
        const current = this.paginationSubject.value;
        this.goToPage(current.pageNumber + 1);
    }

    /**
     * Previous page
     */
    previousPage(): void {
        const current = this.paginationSubject.value;
        this.goToPage(current.pageNumber - 1);
    }

    /**
     * Reset pagination to first page
     */
    resetPagination(): void {
        this.paginationSubject.next({ pageNumber: 1, pageSize: 20 });
    }

    /**
     * Retry after error
     */
    retry(): void {
        this.loadLogs();
    }

    /**
     * Get current filters
     */
    getFilters(): ZoneEntryExitLogFilters {
        return this.filtersSubject.value;
    }

    /**
     * Get current pagination
     */
    getPagination(): PaginationParams {
        return this.paginationSubject.value;
    }

    /**
     * Get unique assets from loaded logs (for filter dropdown)
     */
    getUniqueAssets(): AssetInfo[] {
        return Array.from(this.assetCache.values());
    }

    /**
     * Get unique zones from loaded logs (for filter dropdown)
     */
    getUniqueZones(): ZoneInfo[] {
        return Array.from(this.zoneCache.values());
    }

    /**
     * Clear all caches
     */
    clearCaches(): void {
        this.assetCache.clear();
        this.zoneCache.clear();
    }

    /**
     * Cleanup all resources
     */
    cleanup(): void {
        this.stopPolling();
        this.logsSubject.next([]);
        this.filteredLogsSubject.next([]);
        this.paginatedLogsSubject.next({
            items: [],
            totalCount: 0,
            pageNumber: 1,
            pageSize: 20,
            totalPages: 0,
        });
        this.errorSubject.next(null);
        this.floorMapId = null;
    }

    // ─────────────────────────────────────────────────────────────
    // Private methods
    // ─────────────────────────────────────────────────────────────

    private applyFiltersAndPagination(): void {
        const allLogs = this.logsSubject.value;
        const filters = this.filtersSubject.value;
        const pagination = this.paginationSubject.value;

        // Apply filters
        const filtered = this.applyFilters(allLogs, filters);
        this.filteredLogsSubject.next(filtered);

        // Apply pagination
        const paginated = this.applyPagination(filtered, pagination);
        this.paginatedLogsSubject.next(paginated);
    }

    private applyFilters(logs: ZoneEntryExitLog[], filters: ZoneEntryExitLogFilters): ZoneEntryExitLog[] {
        return logs.filter((log) => {
            if (filters.assetId && log.assetId !== filters.assetId) {
                return false;
            }
            if (filters.zoneId && log.zoneId !== filters.zoneId) {
                return false;
            }
            if (filters.eventType && log.eventType !== filters.eventType) {
                return false;
            }
            if (filters.dateRangeStart) {
                const logDate = new Date(log.enterDateTime);
                if (logDate < filters.dateRangeStart) {
                    return false;
                }
            }
            if (filters.dateRangeEnd) {
                const logDate = new Date(log.enterDateTime);
                if (logDate > filters.dateRangeEnd) {
                    return false;
                }
            }
            return true;
        });
    }

    private applyPagination(
        logs: ZoneEntryExitLog[],
        pagination: PaginationParams
    ): PaginatedResponse<ZoneEntryExitLog> {
        const totalCount = logs.length;
        const totalPages = Math.ceil(totalCount / pagination.pageSize) || 1;
        const startIndex = (pagination.pageNumber - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const items = logs.slice(startIndex, endIndex);

        return {
            items,
            totalCount,
            pageNumber: pagination.pageNumber,
            pageSize: pagination.pageSize,
            totalPages,
        };
    }

    private transformAndEnrichLogs(responses: ZoneEntryExitLogResponse[]): ZoneEntryExitLog[] {
        console.log('Transforming', responses.length, 'responses');
        console.log('Sample response:', responses[0]);
        
        // Sort by enterDateTime descending (most recent first)
        const sorted = [...responses].sort(
            (a, b) => new Date(b.enterDateTime).getTime() - new Date(a.enterDateTime).getTime()
        );

        return sorted.map((response) => {
            const assetId = String(response.assetId || '');
            const zoneId = String(response.zoneId || '');
            
            return {
                id: String(response.id || ''),
                assetId: assetId,
                assetName: this.assetCache.get(assetId)?.name,
                zoneId: zoneId,
                zoneName: this.zoneCache.get(zoneId)?.name,
                eventType: response.exitDateTime ? 'EXIT' : 'ENTRY',
                enterDateTime: response.enterDateTime,
                exitDateTime: response.exitDateTime,
                retentionTime: response.retentionTime,
            };
        });
    }

    private fetchAndCacheAssets(floorMapId: string): Observable<Map<string, AssetInfo>> {
        const url = `${this.assetApiUrl}/floormap/${floorMapId}`;
        console.debug('Fetching assets from:', url);
        return this.http.get<any>(url).pipe(
            map((response) => {
                const assets = response.data || response;
                console.debug('Assets fetched successfully:', assets.length);
                const assetMap = new Map<string, AssetInfo>();
                if (Array.isArray(assets)) {
                    assets.forEach((asset) => {
                        assetMap.set(asset.id.toString(), { id: asset.id, name: asset.name });
                    });
                }
                this.assetCache = assetMap;
                return assetMap;
            }),
            catchError((error: HttpErrorResponse) => {
                console.error('Failed to fetch assets for enrichment from ' + url + ':', error.status, error.message, error);
                return of(this.assetCache);
            })
        );
    }

    private fetchAndCacheZones(floorMapId: string): Observable<Map<string, ZoneInfo>> {
        const url = `${this.zoneApiUrl}/floormap/${floorMapId}`;
        console.debug('Fetching zones from:', url);
        return this.http.get<any>(url).pipe(
            map((response) => {
                const zones = response.data || response;
                console.debug('Zones fetched successfully:', zones.length);
                const zoneMap = new Map<string, ZoneInfo>();
                if (Array.isArray(zones)) {
                    zones.forEach((zone) => {
                        zoneMap.set(zone.id.toString(), { id: zone.id, name: zone.name });
                    });
                }
                this.zoneCache = zoneMap;
                return zoneMap;
            }),
            catchError((error: HttpErrorResponse) => {
                console.error('Failed to fetch zones for enrichment from ' + url + ':', error.status, error.message, error);
                return of(this.zoneCache);
            })
        );
    }

    private extractErrorMessage(error: HttpErrorResponse): string {
        if (error.status === 0) {
            return 'Network error. Please check your connection.';
        }

        if (error.error?.message) {
            return error.error.message;
        }

        switch (error.status) {
            case 400:
                return 'Invalid request';
            case 401:
                return 'Unauthorized. Please log in again.';
            case 403:
                return 'You do not have permission to view these logs.';
            case 404:
                return 'No zone history found for this floor map.';
            case 500:
                return 'Server error. Please try again later.';
            default:
                return 'Failed to load zone entry/exit logs';
        }
    }
}
