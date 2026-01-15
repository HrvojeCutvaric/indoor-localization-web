import { Injectable } from '@angular/core';
import { BehaviorSubject, switchMap, tap } from 'rxjs';
import type { DraftPoint, Zone, ZoneValidationError } from './zone.model';
import { validatePolygon } from './polygon-validation';
import { LocalZonesRepository } from './zones.repository';

@Injectable({ providedIn: 'root' })
export class ZonesService {
    private repo = new LocalZonesRepository();

    private mapId$ = new BehaviorSubject<string | null>(null);

    private zonesSubject = new BehaviorSubject<Zone[]>([]);
    zones$ = this.zonesSubject.asObservable();

    private draftSubject = new BehaviorSubject<DraftPoint[]>([]);
    draftPoints$ = this.draftSubject.asObservable();

    private errorSubject = new BehaviorSubject<ZoneValidationError | null>(null);
    error$ = this.errorSubject.asObservable();

    setMap(mapId: string | number): void {
        const id = String(mapId);
        this.mapId$.next(id);

        this.repo.list(id).subscribe(z => this.zonesSubject.next(z));
        this.resetDraft();
        this.errorSubject.next(null);
    }

    addDraftPoint(point: DraftPoint): void {
        const next = [...this.draftSubject.value, point];
        this.draftSubject.next(next);
        this.errorSubject.next(null);
    }

    resetDraft(): void {
        this.draftSubject.next([]);
        this.errorSubject.next(null);
    }

    finishDraft(name: string): void {
        const mapId = this.mapId$.value;
        if (!mapId) return;

        const pts = this.draftSubject.value;
        const err = validatePolygon(pts);
        if (err) {
            this.errorSubject.next(err);
            return;
        }

        this.repo.create(mapId, name || 'Zone', pts).subscribe(() => {
            this.repo.list(mapId).subscribe(z => this.zonesSubject.next(z));
            this.resetDraft();
        });
    }
}