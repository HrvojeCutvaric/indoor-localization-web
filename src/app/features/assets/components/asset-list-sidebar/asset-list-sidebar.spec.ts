import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssetListSidebar } from './asset-list-sidebar';

describe('AssetListSidebar', () => {
  let component: AssetListSidebar;
  let fixture: ComponentFixture<AssetListSidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetListSidebar],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetListSidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit assetSelected when an asset is clicked', () => {
    const asset = { id: '1', name: 'Test Asset' };
    jest.spyOn(component.assetSelected, 'emit');
    
    component.onSelectAsset(asset);
    
    expect(component.assetSelected.emit).toHaveBeenCalledWith(asset);
  });

  it('should emit addAsset when add button is clicked', () => {
    jest.spyOn(component.addAsset, 'emit');
    
    component.onAddAsset();
    
    expect(component.addAsset.emit).toHaveBeenCalled();
  });
});
