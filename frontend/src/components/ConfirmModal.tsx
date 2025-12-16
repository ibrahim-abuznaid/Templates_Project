import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

type ModalType = 'confirm' | 'success' | 'error' | 'info' | 'warning';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm',
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = true,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-12 h-12 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
      case 'info':
        return <Info className="w-12 h-12 text-blue-500" />;
      case 'confirm':
      default:
        return <AlertTriangle className="w-12 h-12 text-primary-500" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (type) {
      case 'error':
        return 'btn-danger';
      case 'success':
        return 'btn-primary';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors';
      default:
        return 'btn-primary';
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4">
              {getIcon()}
            </div>
            <p className="text-gray-600 whitespace-pre-wrap">{message}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
          {showCancel && (
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={getConfirmButtonClass()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
