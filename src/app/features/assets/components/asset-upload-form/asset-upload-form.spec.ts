import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssetUploadForm } from './asset-upload-form';
import { provideHttpClient } from '@angular/common/http';

describe('AssetUploadForm', () => {
  let component: AssetUploadForm;
  let fixture: ComponentFixture<AssetUploadForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetUploadForm],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetUploadForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have invalid form when name is empty', () => {
    expect(component.form.valid).toBeFalsy();
  });

  it('should have valid form when name is provided', () => {
    component.form.controls['name'].setValue('Test Asset');
    expect(component.form.valid).toBeTruthy();
  });

  it('should emit cancelled when cancel is clicked', () => {
    jest.spyOn(component.cancelled, 'emit');
    
    component.onCancel();
    
    expect(component.cancelled.emit).toHaveBeenCalled();
  });

  it('should populate form in edit mode', () => {
    component.mode = 'edit';
    component.asset = { id: '1', name: 'Test Asset', description: 'Description', status: 'Active' };
    component.ngOnInit();
    
    expect(component.form.get('name')?.value).toBe('Test Asset');
    expect(component.form.get('description')?.value).toBe('Description');
  });
});
