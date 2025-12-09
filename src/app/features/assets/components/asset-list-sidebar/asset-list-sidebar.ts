import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Asset } from '../../asset.model';

@Component({
  selector: 'app-asset-list-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asset-list-sidebar.html',
  styleUrl: './asset-list-sidebar.scss',
})
export class AssetListSidebar {
  @Input() assets: Asset[] = [];
  @Input() selectedAsset: Asset | null = null;
  @Input() loading = false;

  @Output() assetSelected = new EventEmitter<Asset>();
  @Output() addAsset = new EventEmitter<void>();
  @Output() editAsset = new EventEmitter<void>();
  @Output() deleteAsset = new EventEmitter<void>();

  onSelectAsset(asset: Asset): void {
    this.assetSelected.emit(asset);
  }

  onAddAsset(): void {
    this.addAsset.emit();
  }

  onEditAsset(): void {
    this.editAsset.emit();
  }

  onDeleteAsset(): void {
    this.deleteAsset.emit();
  }
}
