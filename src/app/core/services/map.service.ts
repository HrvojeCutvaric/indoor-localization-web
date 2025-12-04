import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Map {
  id: string;
  name: string;
  image?: string;
}

export interface MapError {
  message: string;
  code: string;
}

@Injectable({
  providedIn: 'root',
})
export class MapService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/maps`;
  
  private mapsSubject = new BehaviorSubject<Map[]>([]);
  public maps$ = this.mapsSubject.asObservable();

  private blobUrls = new Set<string>();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private selectedMapSubject = new BehaviorSubject<Map | null>(null);
  public selectedMap$ = this.selectedMapSubject.asObservable();

  constructor() {
    this.loadMaps();
    this.loadSelectedMapFromStorage();
  }

  private loadSelectedMapFromStorage(): void {
    const stored = localStorage.getItem('selectedMap');
    if (stored) {
      try {
        const map = JSON.parse(stored);
        this.selectedMapSubject.next(map);
      } catch (e) {
        console.error('Failed to load selected map from storage', e);
      }
    }
  }

  loadMaps(): void {
    this.loadingSubject.next(true);
    
    const storedMaps = localStorage.getItem('maps');
    if (storedMaps) {
      try {
        const maps = JSON.parse(storedMaps);
        this.mapsSubject.next(maps);
        this.loadingSubject.next(false);
        return;
      } catch (e) {
        console.error('Failed to load maps from storage', e);
      }
    }

    const mockMaps: Map[] = [
      {
        id: '1',
        name: 'Ground Floor',
        image: '/floormaps/demo-floormap.png',
      },
      {
        id: '2',
        name: 'First Floor',
        image: '/floormaps/demo-floormap.png',
      },
      {
        id: '3',
        name: 'Basement',
        image: '/floormaps/demo-floormap.png',
      },
    ];

    setTimeout(() => {
      this.mapsSubject.next(mockMaps);
      this.saveMapsToStorage(mockMaps);
      this.loadingSubject.next(false);
    }, 500);
  }

  getMaps(): Observable<Map[]> {
    return this.maps$;
  }

  getMapById(id: string): Observable<Map> {
    return this.http.get<Map>(`${this.apiUrl}/${id}`);
  }

  createMap(formData: FormData): Observable<Map> {
    this.loadingSubject.next(true);
    return new Observable((observer) => {
      setTimeout(() => {
        const fileEntry = formData.get('image');
        let imageUrl = '/floormaps/new-map.png';
        if (fileEntry && typeof (fileEntry as any).name === 'string') {
          try {
            const file = fileEntry as File;
            imageUrl = URL.createObjectURL(file);
            this.blobUrls.add(imageUrl);
          } catch (e) {
            imageUrl = '/floormaps/new-map.png';
          }
        }

        const mockMap: Map = {
          id: Date.now().toString(),
          name: (formData.get('name') as string) || 'Untitled Map',
          image: imageUrl,
        };

        const currentMaps = this.mapsSubject.value;
        const updatedMaps = [...currentMaps, mockMap];
        this.mapsSubject.next(updatedMaps);
        this.saveMapsToStorage(updatedMaps);
        this.loadingSubject.next(false);
        observer.next(mockMap);
        observer.complete();
      }, 1000);
    });
  }

  updateMap(id: string, formData: FormData): Observable<Map> {
    this.loadingSubject.next(true);
    return new Observable((observer) => {
      setTimeout(() => {
        const currentMaps = this.mapsSubject.value;
        const index = currentMaps.findIndex(m => m.id === id);
        if (index !== -1) {
          const fileEntry = formData.get('image');
          let image = currentMaps[index].image;
          if (fileEntry && typeof (fileEntry as any).name === 'string') {
            try {
              if (image && image.startsWith('blob:')) {
                this.revokeIfBlob(image);
              }
              const file = fileEntry as File;
              image = URL.createObjectURL(file);
              this.blobUrls.add(image);
            } catch (e) {
            }
          }

          currentMaps[index] = {
            ...currentMaps[index],
            name: (formData.get('name') as string) || currentMaps[index].name,
            image,
          };
          const updatedMaps = [...currentMaps];
          this.mapsSubject.next(updatedMaps);
          this.saveMapsToStorage(updatedMaps);
          this.loadingSubject.next(false);
          observer.next(currentMaps[index]);
          observer.complete();
        } else {
          observer.error({ message: 'Map not found', code: '404' });
        }
      }, 800);
    });
  }

  deleteMap(id: string): Observable<void> {
    this.loadingSubject.next(true);
    return new Observable((observer) => {
      setTimeout(() => {
        const currentMaps = this.mapsSubject.value;
        const mapToDelete = currentMaps.find(m => m.id === id);
        if (mapToDelete && mapToDelete.image && mapToDelete.image.startsWith('blob:')) {
          this.revokeIfBlob(mapToDelete.image);
        }
        const filtered = currentMaps.filter(m => m.id !== id);
        this.mapsSubject.next(filtered);
        this.saveMapsToStorage(filtered);
        this.loadingSubject.next(false);
        observer.next();
        observer.complete();
      }, 500);
    });
  }

  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  setSelectedMap(map: Map): void {
    this.selectedMapSubject.next(map);
    localStorage.setItem('selectedMap', JSON.stringify(map));
  }

  getSelectedMap(): Map | null {
    return this.selectedMapSubject.value;
  }

  private saveMapsToStorage(maps: Map[]): void {
    try {
      localStorage.setItem('maps', JSON.stringify(maps));
    } catch (e) {
      console.error('Failed to save maps to storage', e);
    }
  }

  private revokeIfBlob(url?: string) {
    if (!url) return;
    try {
      if (this.blobUrls.has(url)) {
        URL.revokeObjectURL(url);
        this.blobUrls.delete(url);
      }
    } catch (e) {
    }
  }
}
