import { apiService } from '@/services/apiService';

interface LoginResponse {
  access: string;
  refresh: string;
  user: any;
  [key: string]: any;
}

interface TestConnectionResult {
  success: boolean;
  message: string;
  data?: {
    login: any;
    profile?: any;
  };
  error?: any;
}

export async function testConnection(phone: string, password: string): Promise<TestConnectionResult> {
  console.log('Starting connection test...');
  
  // 1. First test direct API access
  try {
    console.log('Testing direct API access...');
    const testResponse = await fetch('http://127.0.0.1:8000/api/v1/auth/login/', {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    if (!testResponse.ok) {
      throw new Error(`Backend not reachable: ${testResponse.status} ${testResponse.statusText}`);
    }
    
    console.log('Backend is reachable');
  } catch (error) {
    console.error('Backend connection failed:', error);
    return {
      success: false,
      message: 'Backend is not reachable. Make sure the Django server is running.',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
  
  // 2. Test login
  try {
    console.log('Testing login with:', { phone });
    
    const loginResponse = await apiService.auth.login(phone, password);
    
    console.log('Login response received:', loginResponse);
    
    if (!loginResponse.data) {
      throw new Error('No data received in login response');    
    }
    
    const { access, refresh, user } = loginResponse.data as LoginResponse;
    
    if (!access) {
      throw new Error('No access token received');
    }
    
    console.log('Login successful, saving tokens...');
    localStorage.setItem('access_token', access);
    if (refresh) {
      localStorage.setItem('refresh_token', refresh);
    }
    
    // 3. Test profile access
    console.log('Testing profile access...');
    const profileResponse = await apiService.auth.getProfile();
    
    return {
      success: true,
      message: 'Connection test successful!',
      data: {
        login: loginResponse.data,
        profile: profileResponse?.data
      }
    };
    
  } catch (error: any) {
    console.error('Login test failed:', error);
    
    let errorMessage = 'Login failed';
    let errorDetails: any = error.message;
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorMessage = error.response.data?.detail || error.response.statusText || 'Login failed';
      errorDetails = error.response.data || error.message;
      
      if (error.response.status === 400) {
        errorMessage = 'Invalid phone number or password';
      } else if (error.response.status === 401) {
        errorMessage = 'Authentication failed';
      } else if (error.response.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'No response from server. Check your connection.';
      errorDetails = 'Request was made but no response received';
    }
    
    return {
      success: false,
      message: errorMessage,
      error: errorDetails
    };
  }
}
