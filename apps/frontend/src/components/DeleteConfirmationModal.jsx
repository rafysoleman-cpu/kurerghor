import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, itemName, isDeleting = false }) => {
  const deleteButtonRef = useRef(null)

  // Auto-focus delete button when modal opens
  useEffect(() => {
    if (isOpen && deleteButtonRef.current) {
      deleteButtonRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Delete Product</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{itemName}"</span>?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This action cannot be undone.
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 justify-end">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              ref={deleteButtonRef}
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmationModal
