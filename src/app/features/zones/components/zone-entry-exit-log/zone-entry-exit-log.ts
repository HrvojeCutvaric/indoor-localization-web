import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
    ZoneEntryExitLog,
    ZoneEntryExitLogFilters,
    PaginatedResponse,
    AssetInfo,
    ZoneInfo,
    ZoneEventType,
} from './zone-entry-exit-log.model';
import { ZoneEntryExitLogService } from './zone-entry-exit-log.service';

@Component({
    selector: 'app-zone-entry-exit-log',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './zone-entry-exit-log.html',
    styleUrls: ['./zone-entry-exit-log.scss'],
})
export class ZoneEntryExitLogComponent implements OnInit, OnDestroy, OnChanges {
    private logService = inject(ZoneEntryExitLogService);
    private destroy$ = new Subject<void>();

    @Input() mapId: string | null = null;
    @Input() mapName: string | null = null;

    // UI states
    loading = false;
    error: string | null = null;

    // Data
    logs: ZoneEntryExitLog[] = [];
    paginatedData: PaginatedResponse<ZoneEntryExitLog> = {
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 20,
        totalPages: 0,
    };

    // Filter options
    availableAssets: AssetInfo[] = [];
    availableZones: ZoneInfo[] = [];

    // Filter form values
    filterAssetId: string = '';
    filterZoneId: string = '';
    filterEventType: ZoneEventType | '' = '';
    filterDateStart: string = '';
    filterDateEnd: string = '';

    ngOnInit(): void {
        this.subscribeToService();

        if (this.mapId) {
            this.initializeLogs();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['mapId'] && !changes['mapId'].firstChange && this.mapId) {
            this.logService.cleanup();
            this.resetFilterForm();
            this.initializeLogs();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.logService.cleanup();
    }

    private subscribeToService(): void {
        this.logService.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
            this.loading = loading;
        });

        this.logService.error$.pipe(takeUntil(this.destroy$)).subscribe((error) => {
            this.error = error;
        });

        this.logService.paginatedLogs$.pipe(takeUntil(this.destroy$)).subscribe((paginated) => {
            this.paginatedData = paginated;
            this.logs = paginated.items;
        });
    }

    private initializeLogs(): void {
        if (!this.mapId) return;

        this.logService.initializeLogs(this.mapId, true);

        // Update available filters after initial load
        setTimeout(() => {
            this.availableAssets = this.logService.getUniqueAssets();
            this.availableZones = this.logService.getUniqueZones();
        }, 1000);
    }

    trackById(_: number, item: ZoneEntryExitLog): string {
        return item.id;
    }

    // ─────────────────────────────────────────────────────────────
    // Filter actions
    // ─────────────────────────────────────────────────────────────

    applyFilters(): void {
        const filters: ZoneEntryExitLogFilters = {};

        if (this.filterAssetId) {
            filters.assetId = this.filterAssetId;
        }
        if (this.filterZoneId) {
            filters.zoneId = this.filterZoneId;
        }
        if (this.filterEventType) {
            filters.eventType = this.filterEventType as ZoneEventType;
        }
        if (this.filterDateStart) {
            filters.dateRangeStart = new Date(this.filterDateStart);
        }
        if (this.filterDateEnd) {
            filters.dateRangeEnd = new Date(this.filterDateEnd);
        }

        this.logService.setFilters(filters);
    }

    clearFilters(): void {
        this.resetFilterForm();
        this.logService.setFilters({});
    }

    private resetFilterForm(): void {
        this.filterAssetId = '';
        this.filterZoneId = '';
        this.filterEventType = '';
        this.filterDateStart = '';
        this.filterDateEnd = '';
    }

    // ─────────────────────────────────────────────────────────────
    // Pagination actions
    // ─────────────────────────────────────────────────────────────

    goToPage(page: number): void {
        this.logService.goToPage(page);
    }

    nextPage(): void {
        this.logService.nextPage();
    }

    previousPage(): void {
        this.logService.previousPage();
    }

    // ─────────────────────────────────────────────────────────────
    // Error handling
    // ─────────────────────────────────────────────────────────────

    retry(): void {
        this.logService.retry();
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    hasFiltersApplied(): boolean {
        return !!(
            this.filterAssetId ||
            this.filterZoneId ||
            this.filterEventType ||
            this.filterDateStart ||
            this.filterDateEnd
        );
    }

    get showPagination(): boolean {
        return this.paginatedData.totalPages > 1;
    }

    get canGoNext(): boolean {
        return this.paginatedData.pageNumber < this.paginatedData.totalPages;
    }

    get canGoPrevious(): boolean {
        return this.paginatedData.pageNumber > 1;
    }

    get pageNumbers(): number[] {
        const total = this.paginatedData.totalPages;
        const current = this.paginatedData.pageNumber;
        const pages: number[] = [];

        // Show max 5 page numbers centered around current
        let start = Math.max(1, current - 2);
        let end = Math.min(total, start + 4);

        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        return pages;
    }
}