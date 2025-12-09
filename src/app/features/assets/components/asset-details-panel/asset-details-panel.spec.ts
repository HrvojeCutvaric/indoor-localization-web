import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssetDetailsPanel } from './asset-details-panel';

describe('AssetDetailsPanel', () => {
  let component: AssetDetailsPanel;
  let fixture: ComponentFixture<AssetDetailsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetDetailsPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDetailsPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display asset details when asset is provided', () => {
    component.asset = { id: 1, name: 'Test Asset', x: 10, y: 20, floorMapId: 2, active: true, color: '#ffaa00' } as any;
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.asset-info')).toBeTruthy();
  });

  it('should show empty state when no asset is selected', () => {
    component.asset = null;
    component.loading = false;
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
  });
});
