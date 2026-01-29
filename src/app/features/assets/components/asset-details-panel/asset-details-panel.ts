import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Asset } from '../../asset.model';
import { MapService, Map } from '../../../../core/services/map.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-asset-details-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asset-details-panel.html',
  styleUrls: ['./asset-details-panel.scss'],
})

export class AssetDetailsPanel implements OnChanges {
  @Input() asset: Asset | null = null;
  @Input() loading = false;

  floorMapName: string | null = null;

  private mapsSub?: Subscription;

  constructor(private mapService: MapService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asset'] && this.asset && this.asset.floorMapId) {
      this.loadFloorMapName(this.asset.floorMapId);
    }
  }

  private loadFloorMapName(floorMapId: number | undefined): void {
    if (!floorMapId) {
      this.floorMapName = null;
      return;
    }

    if (this.mapsSub) {
      this.mapsSub.unsubscribe();
    }

    this.mapsSub = this.mapService.maps$.subscribe((maps: Map[]) => {
      const match = maps.find(m => m.id === floorMapId.toString());
      this.floorMapName = match ? match.name : `ID: ${floorMapId}`;
    });
  }
}