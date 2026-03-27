import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL } from '@/constants/config';
import type { ApiResponse } from '@/types/api.types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '',
      timeout: 60000, // 60 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add any request modifications here (e.g., auth tokens)
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error: AxiosError<ApiResponse<never>>) => {
        const errorMessage = this.handleError(error);
        return Promise.reject(new Error(errorMessage));
      }
    );
  }

  private handleError(error: AxiosError<ApiResponse<never>>): string {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.error?.message || 'An error occurred';
      console.error('API Error:', message, error.response.status);
      return message;
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
      return 'Network error. Please check your connection.';
    } else {
      // Error in request setup
      console.error('Request Error:', error.message);
      return error.message;
    }
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    return this.client.get(url, { params });
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.client.post(url, data);
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.client.put(url, data);
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.client.delete(url);
  }

  async uploadFile<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

export const apiClient = new ApiClient();
