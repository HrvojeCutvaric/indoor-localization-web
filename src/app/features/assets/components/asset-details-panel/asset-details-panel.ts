import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Asset } from '../../asset.model';

@Component({
  selector: 'app-asset-details-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asset-details-panel.html',
  styleUrl: './asset-details-panel.scss',
})
export class AssetDetailsPanel {
  @Input() asset: Asset | null = null;
  @Input() loading = false;
}
