import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/services/api-response.model';

export interface ZoneRetentionEntry {
    id: string;
    assetId: number;
    assetName: string;
    zoneId: number;
    zoneName: string;
    enterDateTime: string;
    exitDateTime: string | null;
    retentionTime: string | null;
    retentionMinutes?: number;
}

export interface ZoneRetentionFilters {
    assetId?: number | null;
    zoneId?: number | null;
    startDate?: string;
    endDate?: string;
    pageNumber?: number;
    pageSize?: number;
}

export interface ZoneRetentionResponse {
    items: ZoneRetentionEntry[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class ZoneRetentionApiService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/Reports/zones/retention`;

    getZoneRetention(filters?: ZoneRetentionFilters): Observable<ApiResponse<ZoneRetentionResponse>> {
        let params = new HttpParams();

        if (filters) {
            if (filters.assetId) {
                params = params.set('assetId', filters.assetId.toString());
            }
            if (filters.zoneId) {
                params = params.set('zoneId', filters.zoneId.toString());
            }
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                if (!isNaN(startDate.getTime())) {
                    params = params.set('startDate', startDate.toISOString());
                }
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                if (!isNaN(endDate.getTime())) {
                    params = params.set('endDate', endDate.toISOString());
                }
            }
            if (filters.pageNumber !== undefined) {
                params = params.set('pageNumber', filters.pageNumber.toString());
            }
            if (filters.pageSize !== undefined) {
                params = params.set('pageSize', filters.pageSize.toString());
            }
        }

        return this.http.get<ApiResponse<ZoneRetentionResponse>>(this.apiUrl, { params });
    }
}
