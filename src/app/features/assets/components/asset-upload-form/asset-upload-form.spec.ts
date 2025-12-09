import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssetUploadForm } from './asset-upload-form';
import { provideHttpClient } from '@angular/common/http';
import { MapService, Map } from '../../../../core/services/map.service';
import { of } from 'rxjs';
import '@testing-library/jest-dom';

describe('AssetUploadForm', () => {
  let component: AssetUploadForm;
  let fixture: ComponentFixture<AssetUploadForm>;
  let mapService: jasmine.SpyObj<MapService>;

  const mockMaps: Map[] = [
    { id: '1', name: 'Floor 1', widthInMeters: 40, heightInMeters: 40 },
    { id: '2', name: 'Floor 2', widthInMeters: 30, heightInMeters: 30 },
  ];

  beforeEach(async () => {
    const mapServiceSpy = jasmine.createSpyObj('MapService', ['getMaps']);
    mapServiceSpy.getMaps.and.returnValue(of(mockMaps));

    await TestBed.configureTestingModule({
      imports: [AssetUploadForm],
      providers: [
        provideHttpClient(),
        { provide: MapService, useValue: mapServiceSpy }
      ],
    }).compileComponents();

    mapService = TestBed.inject(MapService) as jasmine.SpyObj<MapService>;
    fixture = TestBed.createComponent(AssetUploadForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load maps on init', () => {
    expect(mapService.getMaps).toHaveBeenCalled();
    expect(component.maps).toEqual(mockMaps);
  });

  it('should set first map as default in create mode', () => {
    component.mode = 'create';
    component.ngOnInit();
    
    expect(component.form.get('floorMapId')?.value).toBe(1);
  });

  it('should have invalid form when name is empty', () => {
    expect(component.form.valid).toBeFalsy();
  });

  it('should have valid form when required fields are provided', () => {
    component.form.controls['name'].setValue('Test Asset');
    component.form.controls['x'].setValue(10);
    component.form.controls['y'].setValue(20);
    component.form.controls['floorMapId'].setValue(1);
    component.form.controls['color'].setValue('#00ff00');
    expect(component.form.valid).toBeTruthy();
  });

  it('should emit cancelled when cancel is clicked', () => {
    spyOn(component.cancelled, 'emit');
    
    component.onCancel();
    
    expect(component.cancelled.emit).toHaveBeenCalled();
  });

  it('should populate form in edit mode', () => {
    component.mode = 'edit';
    component.asset = { id: 1, name: 'Test Asset', x: 5, y: 6, floorMapId: 2, active: true, color: '#112233' } as any;
    component.ngOnInit();
    
    expect(component.form.get('name')?.value).toBe('Test Asset');
    expect(component.form.get('x')?.value).toBe(5);
    expect(component.form.get('y')?.value).toBe(6);
    expect(component.form.get('floorMapId')?.value).toBe(2);
    expect(component.form.get('color')?.value).toBe('#112233');
  });
});
