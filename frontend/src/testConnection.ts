import { apiService } from '@/services/apiService';

export async function testConnection() {
  try {
    console.log('Testing connection to backend...');
    
    // Login test o'chirildi - production'da haqiqiy foydalanuvchi ma'lumotlari kerak
    throw new Error('Test login o\'chirildi - production\'da haqiqiy foydalanuvchi ma\'lumotlari kerak');
  } catch (error: any) {
    console.error('Connection test failed:', error);
    return {
      success: false,
      message: error.response?.data?.detail || error.message,
      error: error.response?.data || error.message
    };
  }
}