import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL } from '@/constants/config';
import type { ApiResponse } from '@/types/api.types';

export function getSessionToken(sessionId: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(`session_token_${sessionId}`);
}

export function setSessionToken(sessionId: string, token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`session_token_${sessionId}`, token);
}

export function clearSessionToken(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`session_token_${sessionId}`);
  } catch {
    // Ignore storage errors
  }
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000, // 60 seconds
      withCredentials: true,
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
        // Extract sessionId from URL if present and attach session authorization tokens
        if (config.url) {
          const sessionMatch = config.url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
          if (sessionMatch) {
            const sessionId = sessionMatch[0];
            const token = getSessionToken(sessionId);
            if (token) {
              config.headers['X-Session-Token'] = token;
              config.headers['Authorization'] = `Bearer ${token}`;
            }
          }
        }
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
        const err: any = new Error(errorMessage);
        if (error.response?.status) {
          err.statusCode = error.response.status;
          err.status = error.response.status;
        }
        return Promise.reject(err);
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
