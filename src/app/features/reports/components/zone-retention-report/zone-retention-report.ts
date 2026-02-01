import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
    ZoneRetentionApiService,
    ZoneRetentionEntry,
    ZoneRetentionFilters,
    ZoneRetentionResponse,
} from '../../services/zone-retention-api.service';
import { ZonesApiService, ZoneResponse } from '../../../zones/zones-api.service';
import { AssetService } from '../../../assets/asset.service';
import { Asset } from '../../../assets/asset.model';

interface AssetOption {
    id: number;
    name: string;
}

interface ZoneOption {
    id: number;
    name: string;
}

@Component({
    selector: 'app-zone-retention-report',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './zone-retention-report.html',
    styleUrls: ['./zone-retention-report.scss'],
})
export class ZoneRetentionReportComponent implements OnInit, OnDestroy {
    private apiService = inject(ZoneRetentionApiService);
    private zonesApiService = inject(ZonesApiService);
    private assetService = inject(AssetService);
    private destroy$ = new Subject<void>();

    // Expose Math to template
    Math = Math;

    // Data
    retentionData: ZoneRetentionEntry[] = [];
    paginatedData: ZoneRetentionResponse = {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 25,
        totalPages: 0,
    };

    // Filter state - changed to use asset/zone names and IDs
    filterAssetId: number | null = null;
    filterAssetName: string = '';
    filterZoneId: number | null = null;
    filterZoneName: string = '';
    filterStartDate: string = '';
    filterEndDate: string = '';
    searchQuery: string = '';

    // Options for dropdowns
    availableAssets: AssetOption[] = [];
    availableZones: ZoneOption[] = [];

    // UI state
    loading = false;
    error: string | null = null;
    currentPage = 1;
    pageSize = 25;

    // Sorting
    sortColumn: keyof ZoneRetentionEntry = 'enterDateTime';
    sortDirection: 'asc' | 'desc' = 'desc';

    ngOnInit(): void {
        this.loadAssetsAndZones();
        this.loadRetentionData();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Load assets and zones for dropdown filters
     */
    private loadAssetsAndZones(): void {
        // Load all assets
        this.assetService
            .getAssets()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (assets: Asset[]) => {
                    this.availableAssets = assets.map((asset) => ({
                        id: Number(asset.id),
                        name: asset.name || `Asset ${asset.id}`,
                    }));
                    console.log('Available Assets:', this.availableAssets);
                },
                error: (err) => {
                    console.error('Error loading assets:', err);
                    this.availableAssets = [];
                },
            });

        // Load all zones - get from API endpoint for all zones
        this.zonesApiService
            .listAll()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response: any) => {
                    const zones = response.data || response;
                    if (Array.isArray(zones)) {
                        this.availableZones = zones.map((zone: any) => ({
                            id: Number(zone.id),
                            name: zone.name || `Zone ${zone.id}`,
                        }));
                    }
                    console.log('Available Zones:', this.availableZones);
                },
                error: (err) => {
                    console.error('Error loading zones:', err);
                    this.availableZones = [];
                },
            });
    }

    /**
     * Load zone retention data with current filters
     */
    loadRetentionData(page: number = 1): void {
        this.loading = true;
        this.error = null;
        this.currentPage = page;

        const filters: ZoneRetentionFilters = {
            assetId: this.filterAssetId,
            zoneId: this.filterZoneId,
            startDate: this.filterStartDate || undefined,
            endDate: this.filterEndDate || undefined,
            pageNumber: page,
            pageSize: this.pageSize,
        };

        console.log('Loading retention data with filters:', filters);

        this.apiService
            .getZoneRetention(filters)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response: any) => {
                    console.log('Zone Retention Response:', response);
                    console.log('Response type:', typeof response);
                    console.log('Response keys:', response ? Object.keys(response) : 'null');
                    
                    try {
                        // Handle ApiResponse structure
                        let data = response;
                        if (response && response.data) {
                            console.log('Found response.data');
                            data = response.data;
                        }
                        
                        console.log('Processed data:', data);
                        console.log('Data type:', typeof data);
                        console.log('Is array:', Array.isArray(data));
                        
                        // Handle both paginated and non-paginated responses
                        if (Array.isArray(data)) {
                            console.log('Data is array, length:', data.length);
                            // If data is an array, treat it as items without pagination
                            this.paginatedData = {
                                items: data,
                                totalCount: data.length,
                                pageNumber: 1,
                                pageSize: this.pageSize,
                                totalPages: 1,
                            };
                            this.retentionData = data;
                        } else if (data && typeof data === 'object' && 'items' in data) {
                            console.log('Data has items property, count:', data.items?.length);
                            // If data has items property, it's already paginated
                            this.paginatedData = data;
                            this.retentionData = data.items || [];
                        } else if (data && typeof data === 'object') {
                            console.log('Data is object with keys:', Object.keys(data));
                            // Handle case where data itself is the paginated response
                            this.paginatedData = data;
                            this.retentionData = data.items || [];
                        } else {
                            this.error = 'Unexpected data format received from API';
                            this.retentionData = [];
                        }
                        
                        console.log('Final retention data count:', this.retentionData.length);
                        if (this.retentionData.length > 0) {
                            console.log('First item:', this.retentionData[0]);
                        }
                        this.enrichRetentionData();
                    } catch (parseError) {
                        console.error('Error parsing retention data:', parseError);
                        this.error = 'Error processing data: ' + (parseError as any)?.message;
                    }
                    this.loading = false;
                },
                error: (err: any) => {
                    console.error('Error loading retention data:', err);
                    this.error = 'Failed to load retention data: ' + (err?.error?.message || err?.message || 'Unknown error');
                    this.retentionData = [];
                    this.paginatedData = {
                        items: [],
                        totalCount: 0,
                        pageNumber: 1,
                        pageSize: this.pageSize,
                        totalPages: 0,
                    };
                    this.loading = false;
                },
            });
    }

    /**
     * Enrich retention data with calculated fields
     */
    private enrichRetentionData(): void {
        console.log('Raw retention data before enrichment:', this.retentionData);
        console.log('First item structure:', this.retentionData[0]);
        console.log('Available Assets:', this.availableAssets);
        console.log('Available Zones:', this.availableZones);
        
        this.retentionData = this.retentionData.map((entry: any, index: number) => {
            const assetId = entry.assetId || entry.AssetId;
            const zoneId = entry.zoneId || entry.ZoneId;
            
            // Map all possible field name variations for date fields
            const enterTime = entry.enterDateTime || entry.EnterDateTime || entry.entryDateTime || entry.EntryDateTime || entry.enterTime || entry.EnterTime || entry.entryTime || entry.EntryTime;
            const exitTime = entry.exitDateTime || entry.ExitDateTime || entry.exitTime || entry.ExitTime || entry.leaveDateTime || entry.LeaveDateTime;
            
            console.log(`Processing entry ${index}:`, { 
                assetId, 
                zoneId, 
                enterTime, 
                exitTime,
                fullEntry: entry 
            });
            
            // Look up asset name from availableAssets
            const assetName = this.getAssetName(assetId);
            // Look up zone name from availableZones
            const zoneName = this.getZoneName(zoneId);
            
            const enrichedEntry: ZoneRetentionEntry = {
                ...entry,
                // Map potential field name variations
                id: entry.id || entry.Id || '',
                assetId: assetId || 0,
                assetName: assetName || `Asset ${assetId}`,
                zoneId: zoneId || 0,
                zoneName: zoneName || `Zone ${zoneId}`,
                enterDateTime: enterTime || '',
                exitDateTime: exitTime || null,
                retentionTime: entry.retentionTime || entry.RetentionTime || null,
                retentionMinutes: this.calculateRetentionMinutes(enterTime, exitTime),
            };
            
            console.log(`Enriched entry ${index}:`, enrichedEntry);
            return enrichedEntry;
        });

        console.log('Final enriched data:', this.retentionData);
        this.sortData();
    }

    /**
     * Get asset name by ID from loaded assets
     */
    private getAssetName(assetId: number | null | undefined): string {
        if (!assetId) return '';
        const asset = this.availableAssets.find(a => a.id === assetId);
        return asset?.name || '';
    }

    /**
     * Get zone name by ID from loaded zones
     */
    private getZoneName(zoneId: number | null | undefined): string {
        if (!zoneId) return '';
        const zone = this.availableZones.find(z => z.id === zoneId);
        return zone?.name || '';
    }

    /**
     * Calculate retention time in minutes (returns minutes, including fractional)
     */
    private calculateRetentionMinutes(enterTime: string | null | undefined, exitTime: string | null | undefined): number {
        if (!enterTime) {
            console.log('No enter time');
            return 0;
        }
        
        if (!exitTime) {
            console.log('No exit time (still in zone)');
            return 0;
        }

        try {
            console.log('Calculating retention between:', { enterTime, exitTime });
            
            // Parse dates - handle various formats
            let enterDate: Date;
            let exitDate: Date;
            
            // Try parsing as ISO string first, then as any other format
            enterDate = new Date(enterTime);
            exitDate = new Date(exitTime);
            
            // Check if dates are valid
            if (isNaN(enterDate.getTime())) {
                console.log('Invalid enter date:', enterTime);
                return 0;
            }
            if (isNaN(exitDate.getTime())) {
                console.log('Invalid exit date:', exitTime);
                return 0;
            }
            
            const enterMs = enterDate.getTime();
            const exitMs = exitDate.getTime();
            
            console.log('Parsed timestamps:', { enterMs, exitMs, enterDate: enterDate.toISOString(), exitDate: exitDate.toISOString() });
            
            if (exitMs <= enterMs) {
                console.log('Exit time is before or equal to enter time');
                return 0;
            }
            
            const minutes = (exitMs - enterMs) / (1000 * 60);
            console.log('Calculated minutes:', minutes);
            return minutes;
        } catch (error) {
            console.error('Error calculating retention time:', error, { enterTime, exitTime });
            return 0;
        }
    }

    /**
     * Apply filters and reload data
     */
    applyFilters(): void {
        this.currentPage = 1;
        this.loadRetentionData(1);
    }

    /**
     * Reset all filters
     */
    resetFilters(): void {
        this.filterAssetId = null;
        this.filterZoneId = null;
        this.filterStartDate = '';
        this.filterEndDate = '';
        this.searchQuery = '';
        this.sortColumn = 'enterDateTime';
        this.sortDirection = 'desc';
        this.currentPage = 1;
        this.loadRetentionData(1);
    }

    /**
     * Handle pagination - go to previous page
     */
    previousPage(): void {
        if (this.currentPage > 1) {
            this.loadRetentionData(this.currentPage - 1);
        }
    }

    /**
     * Handle pagination - go to next page
     */
    nextPage(): void {
        if (this.currentPage < this.paginatedData.totalPages) {
            this.loadRetentionData(this.currentPage + 1);
        }
    }

    /**
     * Go to specific page
     */
    goToPage(page: number): void {
        if (page >= 1 && page <= this.paginatedData.totalPages) {
            this.loadRetentionData(page);
        }
    }

    /**
     * Handle column header click for sorting
     */
    sortByColumn(column: keyof ZoneRetentionEntry): void {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.sortData();
    }

    /**
     * Sort data by current sort column and direction
     */
    private sortData(): void {
        this.retentionData.sort((a, b) => {
            const aValue = a[this.sortColumn];
            const bValue = b[this.sortColumn];

            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;

            let comparison = 0;
            if (typeof aValue === 'string') {
                comparison = (aValue as string).localeCompare(bValue as string);
            } else if (typeof aValue === 'number') {
                comparison = (aValue as number) - (bValue as number);
            }

            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * Check if a column is sortable
     */
    isSortable(column: keyof ZoneRetentionEntry): boolean {
        const sortableColumns: Array<keyof ZoneRetentionEntry> = [
            'assetName',
            'zoneName',
            'enterDateTime',
            'exitDateTime',
            'retentionMinutes',
        ];
        return sortableColumns.includes(column);
    }

    /**
     * Get sort indicator for column header
     */
    getSortIndicator(column: keyof ZoneRetentionEntry): string {
        if (this.sortColumn !== column) return '';
        return this.sortDirection === 'asc' ? '▲' : '▼';
    }

    /**
     * Format date/time for display
     */
    formatDateTime(dateString: string | null | undefined): string {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    /**
     * Format retention time for display
     */
    formatRetentionTime(minutes: number | undefined): string {
        if (minutes === undefined || minutes === null || minutes === 0) return '-';

        // If less than 1 minute, show in seconds
        if (minutes < 1) {
            const seconds = Math.round(minutes * 60);
            return seconds > 0 ? `${seconds}s` : '-';
        }

        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        }

        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);

        if (mins === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${mins}m`;
    }

    /**
     * Get CSS class for retention time cells (for highlighting long retentions)
     */
    getRetentionTimeClass(minutes: number | undefined): string {
        if (!minutes) return '';
        if (minutes > 480) return 'high-retention';
        if (minutes > 120) return 'medium-retention';
        return '';
    }

    /**
     * Get page numbers for pagination display
     */
    getPageNumbers(): number[] {
        const totalPages = this.paginatedData.totalPages;
        const current = this.currentPage;
        const pages: number[] = [];

        const startPage = Math.max(1, current - 2);
        const endPage = Math.min(totalPages, current + 2);

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return pages;
    }

    /**
     * Export data to CSV
     */
    exportToCSV(): void {
        if (this.retentionData.length === 0) {
            this.error = 'No data to export';
            return;
        }

        const headers = [
            'Asset Name',
            'Zone Name',
            'Enter Time',
            'Exit Time',
            'Retention Time (minutes)',
        ];
        const rows = this.retentionData.map((entry) => [
            entry.assetName,
            entry.zoneName,
            entry.enterDateTime,
            entry.exitDateTime || '-',
            entry.retentionMinutes || '-',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) =>
                row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
            ),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `zone-retention-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
    }
}
