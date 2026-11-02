import React, { createContext, useContext, useState } from 'react';
import Toast from './Toast';

interface ToastContextType {
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  toast: { message: string; type: 'info' | 'success' | 'error'; visible: boolean };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false,
  });

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({
      message,
      type,
      visible: true,
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setToast({
        message: '',
        type: 'info',
        visible: false,
      });
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <Toast {...toast} onClose={() => setToast({ message: '', type: 'info', visible: false })} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
