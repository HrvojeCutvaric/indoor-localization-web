import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type ZoneEventType = 'ENTRY' | 'EXIT';

interface ZoneEntryExitLog {
    id: string;
    assetId: string;
    assetName?: string;
    zoneId: string;
    zoneName?: string;
    eventType: ZoneEventType;
    timestamp: string;
}

@Component({
    selector: 'app-zone-entry-exit-log',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './zone-entry-exit-log.html',
    styleUrls: ['./zone-entry-exit-log.scss'],
})
export class ZoneEntryExitLogComponent {
    @Input() mapId: string | null = null;
    @Input() mapName: string | null = null;

    // UI states
    loading = false;
    error: string | null = null;

    // Mock data
    logs: ZoneEntryExitLog[] = [
        {
            id: '1',
            assetId: 'A-100',
            assetName: 'Forklift #1',
            zoneId: 'Z-1',
            zoneName: 'Storage',
            eventType: 'ENTRY',
            timestamp: new Date().toISOString(),
        },
        {
            id: '2',
            assetId: 'A-100',
            assetName: 'Forklift #1',
            zoneId: 'Z-1',
            zoneName: 'Storage',
            eventType: 'EXIT',
            timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
        },
    ];

    trackById(_: number, item: ZoneEntryExitLog) {
        return item.id;
    }

    retry() {
        // UI hook za error state
    }
}