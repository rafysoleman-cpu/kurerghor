import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  ArrowLeft,
  Save,
  Upload,
  X,
  Package,
  Plus,
  Trash2,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { vendorAPI } from '../../services/api'
import { invalidateCatalog } from '../../utils/queryKeys'
import uploadService from '../../services/uploadService'
import uploadRecoveryService from '../../services/uploadRecoveryService'
import LoadingSpinner from '../../components/LoadingSpinner'
import UploadRetryPopup from '../../components/UploadRetryPopup'
import EnterpriseUploadProgressBar from '../../components/EnterpriseUploadProgressBar'

const VendorProductAdd = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isSubmittingRef = useRef(false) // Add ref for submission protection
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    comparePrice: '',
    costPrice: '',
    sku: '',
    barcode: '',
    trackQuantity: true,
    quantity: '',
    allowBackorder: false,
    weight: '',
    dimensions: {
      length: '',
      width: '',
      height: ''
    },
    categoryId: '',
    status: 'pending',
    tags: '',
    seoTitle: '',
    seoDescription: '',
    images: []
  })
  const [previewImages, setPreviewImages] = useState([])
  const [errors, setErrors] = useState({})
  const [tagInput, setTagInput] = useState('')
  
  // Enhanced upload state
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    uploadProgress: 0,
    uploadId: null,
    showRetryPopup: false,
    lastError: null,
    uploadData: null,
    isRetrying: false,
    currentImageIndex: 0,
    totalImages: 0,
    uploadStartTime: null
  })

  const queryClient = useQueryClient()

  const { data: categoriesData } = useQuery(
    'vendorCategoriesForProduct',
    () => vendorAPI.getCategories({ page: 1, limit: 100 }),
    { staleTime: 30 * 1000 }
  )

  const categories = categoriesData?.data?.categories || []

  // Enhanced upload mutation with retry handling
  const createProductMutation = useMutation(
    (productData) => uploadService.uploadProduct(productData),
    {
      onSuccess: (data) => {
        console.log('✅ Product created successfully:', data)
        // Clear any recovery data on success
        uploadRecoveryService.clearAllRecoveryData()
          // Don't navigate here since we already navigated in handleSubmit
          // The vendor products page will handle the success via custom event or reload
          // Invalidate here too in case that event never fires.
          invalidateCatalog(queryClient)
      },
      onError: (error) => {
        console.error('❌ Product upload failed:', error)
        handleUploadError(error)
      },
      onSettled: () => {
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          uploadProgress: 0,
          uploadId: null,
          uploadStartTime: null
        }))
      }
    }
  )

  // Initialize form with recovery data if available
  useEffect(() => {
    // Check for recovery data from navigation state
    if (location.state?.retryData) {
      console.log('🔄 Restoring form data from retry state')
      restoreFormFromRetryData(location.state.retryData)
    }
    // Check for session recovery data
    else {
      checkAndRestoreSessionData()
    }
  }, [location.state])

  // Listen for upload progress events
  useEffect(() => {
    const handleProgress = (event) => {
      const { progress, uploadId, currentImage, totalImages } = event.detail
      if (uploadId === uploadState.uploadId) {
        setUploadState(prev => ({ 
          ...prev, 
          uploadProgress: progress,
          currentImageIndex: currentImage || prev.currentImageIndex,
          totalImages: totalImages || prev.totalImages
        }))
      }
    }

    const handleMonitoring = (event) => {
      const { uploadId, isStuck } = event.detail
      if (uploadId === uploadState.uploadId && isStuck) {
        console.warn('⚠️ Upload appears to be stuck')
      }
    }

    window.addEventListener('productUploadProgress', handleProgress)
    window.addEventListener('productUploadMonitoring', handleMonitoring)

    return () => {
      window.removeEventListener('productUploadProgress', handleProgress)
      window.removeEventListener('productUploadMonitoring', handleMonitoring)
    }
  }, [uploadState.uploadId])

  // Restore form from retry data
  const restoreFormFromRetryData = (retryData) => {
    if (retryData.formData) {
      if (retryData.formData instanceof FormData) {
        // Handle FormData restoration
        const restoredFormData = {}
        for (let [key, value] of retryData.formData.entries()) {
          if (key !== 'images') {
            restoredFormData[key] = value
          }
        }
        setFormData(prev => ({ ...prev, ...restoredFormData }))
      } else {
        // Handle object restoration
        setFormData(prev => ({ ...prev, ...retryData.formData }))
      }
    }
  }

  // Check and restore session data
  const checkAndRestoreSessionData = () => {
    const recoverySummary = uploadRecoveryService.getRecoverySummary()
    if (recoverySummary.validEntries > 0) {
      console.log('💾 Found recovery data:', recoverySummary)
      // You could show a notification here to restore previous data
    }
  }

  // Handle upload errors with retry popup
  const handleUploadError = (error) => {
    // Save current form data for recovery
    const formDataToSubmit = prepareFormData()
    uploadRecoveryService.saveUploadData(formDataToSubmit, uploadState.uploadId, error)
    
    setUploadState(prev => ({
      ...prev,
      showRetryPopup: true,
      lastError: error,
      uploadData: {
        formData: formDataToSubmit,
        originalFormData: { ...formData },
        previewImages: [...previewImages]
      }
    }))
  }

  // Prepare FormData for upload
  const prepareFormData = () => {
    const formDataToSubmit = new FormData()
    
    // Add all basic fields
    Object.keys(formData).forEach(key => {
      if (key === 'dimensions') {
        formDataToSubmit.append('dimensions', JSON.stringify(formData.dimensions))
      } else if (key === 'tags') {
        formDataToSubmit.append('tags', JSON.stringify(formData.tags))
      } else if (key !== 'images') {
        formDataToSubmit.append(key, formData[key])
      }
    })

    // Add images
    formData.images.forEach((image, index) => {
      formDataToSubmit.append(`images`, image)
    })

    return formDataToSubmit
  }

  // Handle upload retry
  const handleRetryUpload = async () => {
    setUploadState(prev => ({ 
      ...prev, 
      isRetrying: true, 
      isUploading: true, // FIX: Set isUploading to true so socket listener works
      showRetryPopup: false 
    }))
    
    try {
      const formDataToSubmit = uploadState.uploadData.formData
      const uploadId = uploadService.generateUploadId()
      
      setUploadState(prev => ({ 
        ...prev, 
        uploadId, 
        uploadStartTime: Date.now()
      }))
      
      await createProductMutation.mutateAsync(formDataToSubmit)
    } catch (error) {
      console.error('❌ Retry failed:', error)
      setUploadState(prev => ({ ...prev, isRetrying: false }))
    }
  }

  // Handle edit retry (redirect with preserved data)
  const handleEditRetry = () => {
    if (uploadState.uploadData) {
      navigate('/product/add', {
        state: {
          retryData: uploadState.uploadData,
          error: uploadState.lastError
        }
      })
    }
    setUploadState(prev => ({ ...prev, showRetryPopup: false }))
  }

  // Close retry popup
  const handleCloseRetryPopup = () => {
    setUploadState(prev => ({ ...prev, showRetryPopup: false }))
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const fieldValue = type === 'checkbox' ? checked : value
    
    setFormData(prev => ({
      ...prev,
      [name]: fieldValue
    }))

    // Auto-generate slug from name
    if (name === 'name') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      setFormData(prev => ({
        ...prev,
        slug
      }))
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleDimensionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        [field]: value
      }
    }))
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)
    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({
          ...prev,
          images: 'Each image should be less than 5MB'
        }))
        return false
      }
      return true
    })

    const newImages = [...formData.images, ...validFiles]
    setFormData(prev => ({
      ...prev,
      images: newImages
    }))

    // Create preview URLs
    const newPreviews = validFiles.map(file => URL.createObjectURL(file))
    setPreviewImages(prev => [...prev, ...newPreviews])
  }

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
    setPreviewImages(prev => {
      const newPreviews = prev.filter((_, i) => i !== index)
      // Revoke the removed URL to free memory
      if (prev[index]) {
        URL.revokeObjectURL(prev[index])
      }
      return newPreviews
    })
  }

  const handleTagAdd = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  const handleTagRemove = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Prevent double submission using ref for immediate protection
    if (isSubmittingRef.current || uploadState.isUploading) {
      console.log('⚠️ Form submission already in progress, ignoring duplicate click')
      return
    }
    
    // Set submission ref
    isSubmittingRef.current = true
    
    // Check if force fail is enabled (for testing)
    const forceFail = e.nativeEvent?.shiftKey || false
    if (forceFail) {
      console.log('🧪 FORCE FAIL MODE - Shift+Click detected')
    }
    
    try {
      const formDataToSubmit = prepareFormData()
      const uploadId = uploadService.generateUploadId()
      
      // Store upload data in sessionStorage for potential background tracking
      const uploadInfo = {
        uploadId,
        productName: formData.name || 'Product',
        imageCount: formData.images?.length || 0,
        startTime: Date.now(),
        status: 'started'
      }
      sessionStorage.setItem('vendorProductUploadData', JSON.stringify(uploadInfo))
      sessionStorage.setItem('vendorProductUploadProgress', '0')
      
      setUploadState(prev => ({
        ...prev,
        isUploading: true,
        uploadId,
        uploadProgress: 0,
        showRetryPopup: false,
        lastError: null,
        uploadStartTime: Date.now()
      }))
      
      // Save form data for recovery before upload
      uploadRecoveryService.saveUploadData(formDataToSubmit, uploadId)
      
      // Navigate immediately to vendor products page - upload continues in background
      navigate('/vendor/products')
      
      // Start the upload in background
      createProductMutation.mutateAsync(formDataToSubmit, { forceFail })
    } catch (error) {
      console.error('❌ Upload submission failed:', error)
    } finally {
      // Reset submission ref
      isSubmittingRef.current = false
    }
  }

  return (
    <>
      {/* Enterprise Upload Progress Bar */}
      <EnterpriseUploadProgressBar
        isUploading={uploadState.isUploading}
        uploadProgress={uploadState.uploadProgress}
        uploadData={uploadState.isUploading ? {
          productName: formData.name || 'Product',
          imageCount: formData.images?.length || 0,
          startTime: uploadState.uploadStartTime || Date.now()
        } : null}
        currentImageIndex={uploadState.currentImageIndex}
        totalImages={uploadState.totalImages}
        onDismiss={() => {
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
            uploadProgress: 0,
            uploadData: null,
            currentImageIndex: 0,
            totalImages: 0,
            uploadStartTime: null
          }))
        }}
      />

      <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/vendor/products')}
          className="flex items-center text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">Add New Product</h1>
        <p className="text-gray-600 dark:text-slate-400">Create a new product for your store</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`input ${errors.name ? 'border-error-500' : ''}`}
                  placeholder="Enter product name"
                  required
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  URL Slug *
                </label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  className={`input ${errors.slug ? 'border-error-500' : ''}`}
                  placeholder="product-url-slug"
                  required
                />
                {errors.slug && (
                  <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.slug}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="4"
                className="input"
                placeholder="Describe your product..."
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Pricing</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Price *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-slate-400">$</span>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className={`input pl-8 ${errors.price ? 'border-error-500' : ''}`}
                    placeholder="0.00"
                    required
                  />
                </div>
                {errors.price && (
                  <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.price}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Compare at Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-slate-400">$</span>
                  <input
                    type="number"
                    name="comparePrice"
                    value={formData.comparePrice}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="input pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Cost Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-slate-400">$</span>
                  <input
                    type="number"
                    name="costPrice"
                    value={formData.costPrice}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="input pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Inventory</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  SKU
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="SKU-12345"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Barcode
                </label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="1234567890"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="trackQuantity"
                    checked={formData.trackQuantity}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Track quantity</span>
                </label>
              </div>

              {formData.trackQuantity && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                    className="input"
                    placeholder="0"
                    required={formData.trackQuantity}
                  />
                </div>
              )}
            </div>

            <div className="mt-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="allowBackorder"
                  checked={formData.allowBackorder}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Allow backorder</span>
              </label>
            </div>
          </div>

          {/* Product Organization */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Product Organization</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Category *
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleInputChange}
                className={`input ${errors.categoryId ? 'border-error-500' : ''}`}
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.categoryId}</p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="input"
                required
              >
                <option value="pending">Pending Review</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Note: New products will be reviewed by administrators before being published
              </p>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Tags
              </label>
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleTagAdd())}
                  className="input flex-1"
                  placeholder="Add a tag..."
                />
                <button
                  type="button"
                  onClick={handleTagAdd}
                  className="btn-secondary"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleTagRemove(tag)}
                        className="ml-2 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Shipping */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Shipping</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="input"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Dimensions (cm)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={formData.dimensions.length}
                    onChange={(e) => handleDimensionChange('length', e.target.value)}
                    step="0.1"
                    min="0"
                    className="input"
                    placeholder="Length"
                  />
                  <input
                    type="number"
                    value={formData.dimensions.width}
                    onChange={(e) => handleDimensionChange('width', e.target.value)}
                    step="0.1"
                    min="0"
                    className="input"
                    placeholder="Width"
                  />
                  <input
                    type="number"
                    value={formData.dimensions.height}
                    onChange={(e) => handleDimensionChange('height', e.target.value)}
                    step="0.1"
                    min="0"
                    className="input"
                    placeholder="Height"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Product Images</h2>
            
            <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-slate-500 transition-colors">
              <input
                type="file"
                id="product-images"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
              <label
                htmlFor="product-images"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-8 h-8 text-gray-400 dark:text-slate-500 mb-2" />
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  Click to upload images
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  PNG, JPG, GIF up to 5MB each
                </span>
              </label>
            </div>
            {errors.images && (
              <p className="mt-2 text-sm text-error-600 dark:text-error-400">{errors.images}</p>
            )}

            {previewImages.length > 0 && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {previewImages.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Product preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-error-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SEO */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">SEO</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  SEO Title
                </label>
                <input
                  type="text"
                  name="seoTitle"
                  value={formData.seoTitle}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="SEO title for search engines"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  SEO Description
                </label>
                <textarea
                  name="seoDescription"
                  value={formData.seoDescription}
                  onChange={handleInputChange}
                  rows="3"
                  className="input"
                  placeholder="SEO description for search engines"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-slate-400">
                <p>💡 Hold Shift + Click "Create Product" to force fail for testing</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => navigate('/vendor/products')}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadState.isUploading || isSubmittingRef.current}
                  className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadState.isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Create Product</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
    
    {/* Upload Retry Popup */}
    <UploadRetryPopup
      isOpen={uploadState.showRetryPopup}
      onClose={handleCloseRetryPopup}
      error={uploadState.lastError}
      uploadData={uploadState.uploadData}
      onRetry={handleRetryUpload}
      isRetrying={uploadState.isRetrying}
    />
    </>
  )
}

export default VendorProductAdd
