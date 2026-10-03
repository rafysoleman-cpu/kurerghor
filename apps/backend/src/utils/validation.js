import Joi from 'joi';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const JSON_BODY_FIELDS = [
  'dimensions',
  'tags',
  'weight',
  'inventory',
  'seo',
  'subcategories',
  'imagesJson',
  'uploadedImages',
  'video',
  'variants',
  'flashSale',
  'shipping',
  'tax'
];

const PRODUCT_STATUSES = ['draft', 'active', 'archived', 'deleted'];
const PRODUCT_VISIBILITIES = ['public', 'private', 'hidden'];

const imageSchema = Joi.object({
  url: Joi.string().uri().required(),
  alt: Joi.string().allow('').optional(),
  fileId: Joi.string().allow('').optional(),
  isMain: Joi.boolean().optional()
});

const moneySchema = Joi.alternatives().try(
  Joi.number().min(0),
  Joi.string().allow('')
).optional();

// Validation middleware
export const validate = (schema) => {
  return (req, res, next) => {
    let data = req.body;
    
    // Handle FormData - parse JSON strings only for specific fields
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      data = {};
      Object.keys(req.body).forEach(key => {
        if (JSON_BODY_FIELDS.includes(key)) {
          try {
            if (key === 'tags' && (req.body[key] === '' || req.body[key] === '""' || req.body[key] === '[]')) {
              data[key] = [];
            } else {
              data[key] = JSON.parse(req.body[key]);
            }
          } catch {
            if (key === 'tags' && (req.body[key] === '' || req.body[key] === '""')) {
              data[key] = [];
            } else {
              data[key] = req.body[key];
            }
          }
        } else if (key === 'category') {
          // Special handling for category field - it might be sent as array
          if (Array.isArray(req.body[key])) {
            // Take the last non-empty value from the array
            const categoryValue = req.body[key].filter(cat => cat !== '').pop() || '';
            data[key] = categoryValue;
          } else {
            data[key] = req.body[key];
          }
        } else {
          // Keep all other fields as strings
          data[key] = req.body[key];
        }
      });
    }
    
    const { error } = schema.validate(data, { abortEarly: false, convert: true });
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: details[0]?.message || 'Validation failed',
        details
      });
    }
    
    // Update req.body with parsed data for downstream middleware
    req.body = data;
    next();
  };
};

// User validation schemas
export const registerSchema = Joi.object({
  name: Joi.string().required().min(2).max(50),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
  phone: Joi.string().optional()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Email auth schemas
export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().required().min(6)
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().optional().min(2).max(50),
  phone: Joi.string().optional(),
  avatar: Joi.string().uri().optional()
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().required().min(6)
});

// Interface theme preference. Kept out of updateProfileSchema on purpose: a
// profile save must never be able to clobber the theme, and the theme must not
// require a profile-shaped payload.
export const updateThemeSchema = Joi.object({
  theme: Joi.string().valid('light', 'dark', 'system').required()
});

// Product validation schemas
export const createProductSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  slug: Joi.string().optional().min(1).max(100),
  description: Joi.string().optional().allow('').max(2000),
  shortDescription: Joi.string().optional().max(200),
  category: Joi.string().required().pattern(OBJECT_ID),
  subcategories: Joi.array().items(Joi.string().pattern(OBJECT_ID)).optional(),
  brand: Joi.string().optional(),
  sku: Joi.string().optional(),
  barcode: Joi.string().optional().allow(''),
  price: Joi.number().required().min(0),
  compareAtPrice: moneySchema,
  costPrice: moneySchema,
  images: Joi.array().items(imageSchema).optional(),
  video: Joi.object({
    // An empty url is how the client clears a previously stored video
    url: Joi.string().uri().allow('').required(),
    thumbnail: Joi.string().uri().allow('').optional()
  }).optional(),
  variants: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    options: Joi.array().items(Joi.string()).required(),
    price: Joi.number().required().min(0),
    sku: Joi.string().optional().allow(''),
    image: Joi.string().uri().allow('').optional(),
    inventory: Joi.number().required().min(0)
  })).optional(),
  inventory: Joi.object({
    quantity: Joi.number().required().min(0),
    trackQuantity: Joi.boolean().optional(),
    allowBackorder: Joi.boolean().optional(),
    lowStockThreshold: Joi.number().optional().min(0)
  }).required(),
  weight: Joi.object({
    value: Joi.number().required().min(0),
    unit: Joi.string().valid('kg', 'g', 'lb', 'oz').optional()
  }).optional(),
  dimensions: Joi.object({
    length: Joi.number().required().min(0),
    width: Joi.number().required().min(0),
    height: Joi.number().required().min(0),
    unit: Joi.string().valid('cm', 'in').optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  seo: Joi.object({
    title: Joi.string().optional().allow(''),
    description: Joi.string().optional().allow(''),
    keywords: Joi.array().items(Joi.string()).optional()
  }).optional(),
  status: Joi.string().valid(...PRODUCT_STATUSES).optional(),
  visibility: Joi.string().valid(...PRODUCT_VISIBILITIES).optional(),
  featured: Joi.boolean().optional(),
  vendor: Joi.string().optional().allow('').pattern(OBJECT_ID),
  shipping: Joi.object({
    freeShipping: Joi.boolean().optional(),
    shippingCost: Joi.number().optional().min(0),
    shippingWeight: Joi.number().optional().min(0),
    shippingDimensions: Joi.object({
      length: Joi.number().required().min(0),
      width: Joi.number().required().min(0),
      height: Joi.number().required().min(0)
    }).optional()
  }).optional(),
  flashSale: Joi.object({
    enabled: Joi.boolean().optional(),
    discountPercentage: Joi.number().min(0).max(100).allow(null, '').optional(),
    startDate: Joi.date().allow(null, '').optional(),
    endDate: Joi.date().allow(null, '').optional(),
    maxQuantity: Joi.number().min(0).allow(null, '').optional()
  }).optional(),
  tax: Joi.object({
    taxable: Joi.boolean().optional(),
    taxRate: Joi.number().min(0).allow(null, '').optional()
  }).optional(),
  uploadId: Joi.string().optional()
});

export const updateProductSchema = Joi.object({
  name: Joi.string().optional().min(1).max(100),
  slug: Joi.string().optional().min(1).max(120),
  description: Joi.string().optional().allow('').max(2000),
  shortDescription: Joi.string().optional().allow('').max(200),
  brand: Joi.string().optional().allow(''),
  sku: Joi.string().optional().allow('').max(64),
  barcode: Joi.string().optional().allow('').max(64),
  category: Joi.string().optional().pattern(OBJECT_ID),
  subcategories: Joi.array().items(Joi.string().pattern(OBJECT_ID)).optional(),
  vendor: Joi.string().optional().allow('').pattern(OBJECT_ID),
  price: Joi.number().optional().min(0),
  compareAtPrice: moneySchema,
  costPrice: moneySchema,
  // Retained metadata for existing images travels as JSON because the multipart
  // field name `images` is reserved for newly uploaded files
  imagesJson: Joi.array().items(imageSchema).max(10).optional(),
  uploadedImages: Joi.array().items(imageSchema).max(10).optional(),
  video: Joi.object({
    // An empty url is how the client clears a previously stored video
    url: Joi.string().uri().allow('').required(),
    thumbnail: Joi.string().uri().allow('').optional()
  }).optional(),
  variants: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    options: Joi.array().items(Joi.string()).required(),
    price: Joi.number().required().min(0),
    sku: Joi.string().optional().allow(''),
    image: Joi.string().uri().allow('').optional(),
    inventory: Joi.number().required().min(0)
  })).optional(),
  inventory: Joi.object({
    quantity: Joi.number().min(0),
    trackQuantity: Joi.boolean().optional(),
    allowBackorder: Joi.boolean().optional(),
    lowStockThreshold: Joi.number().optional().min(0)
  }).optional(),
  weight: Joi.object({
    value: Joi.number().required().min(0),
    unit: Joi.string().valid('kg', 'g', 'lb', 'oz').optional()
  }).optional(),
  dimensions: Joi.object({
    length: Joi.number().required().min(0),
    width: Joi.number().required().min(0),
    height: Joi.number().required().min(0),
    unit: Joi.string().valid('cm', 'in').optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  seo: Joi.object({
    title: Joi.string().optional().allow(''),
    description: Joi.string().optional().allow(''),
    keywords: Joi.array().items(Joi.string()).optional()
  }).optional(),
  status: Joi.string().valid(...PRODUCT_STATUSES).optional(),
  visibility: Joi.string().valid(...PRODUCT_VISIBILITIES).optional(),
  featured: Joi.boolean().optional(),
  shipping: Joi.object({
    freeShipping: Joi.boolean().optional(),
    shippingCost: Joi.number().optional().min(0).allow(''),
    shippingWeight: Joi.number().optional().min(0).allow(''),
    shippingDimensions: Joi.object({
      length: Joi.number().required().min(0),
      width: Joi.number().required().min(0),
      height: Joi.number().required().min(0)
    }).optional()
  }).optional(),
  flashSale: Joi.object({
    enabled: Joi.boolean().optional(),
    discountPercentage: Joi.number().min(0).max(100).allow(null, '').optional(),
    startDate: Joi.date().allow(null, '').optional(),
    endDate: Joi.date().allow(null, '').optional(),
    maxQuantity: Joi.number().min(0).allow(null, '').optional()
  }).optional(),
  tax: Joi.object({
    taxable: Joi.boolean().optional(),
    taxRate: Joi.number().min(0).allow(null, '').optional()
  }).optional(),
  uploadId: Joi.string().optional(),
  // Consumed by the vendor update route when captioning newly uploaded images
  imageAlt: Joi.string().optional().allow('')
});

export const createCategorySchema = Joi.object({
  name: Joi.string().required().min(1).max(50),
  description: Joi.string().optional().max(500),
  image: Joi.string().uri().optional(),
  icon: Joi.string().optional(),
  parent: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  sortOrder: Joi.number().optional().min(0),
  seo: Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    keywords: Joi.array().items(Joi.string()).optional()
  }).optional()
});

// Order validation schemas
export const createOrderSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    product: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
    variant: Joi.object({
      name: Joi.string().required(),
      option: Joi.string().required()
    }).optional(),
    quantity: Joi.number().required().min(1)
  })).required().min(1),
  paymentMethod: Joi.string().valid('aamarpay', 'cash_on_delivery', 'bank_transfer').required(),
  shippingAddress: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    address: Joi.string().required(),
    city: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().required()
  }).required(),
  billingAddress: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    address: Joi.string().required(),
    city: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().required()
  }).optional(),
  couponCode: Joi.string().optional(),
  notes: Joi.string().optional().max(500)
});

// Review validation schemas
export const createReviewSchema = Joi.object({
  product: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  order: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  rating: Joi.number().required().min(1).max(5),
  title: Joi.string().required().min(1).max(100),
  content: Joi.string().required().min(1).max(1000),
  images: Joi.array().items(Joi.object({
    url: Joi.string().uri().required(),
    alt: Joi.string().optional()
  })).optional()
});

// Coupon validation schemas
export const createCouponSchema = Joi.object({
  code: Joi.string().required().min(1).max(20),
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().optional().max(500),
  type: Joi.string().valid('percentage', 'fixed').required(),
  value: Joi.number().required().min(0),
  minimumAmount: Joi.number().optional().min(0),
  maximumDiscount: Joi.number().optional().min(0),
  usageLimit: Joi.number().optional().min(1),
  userUsageLimit: Joi.number().optional().min(1),
  applicableProducts: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).optional(),
  applicableCategories: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).optional(),
  excludedProducts: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).optional(),
  excludedCategories: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().required()
});

// Admin authentication schemas
export const adminLoginSchema = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email'
    }),
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    })
});

export const adminOTPSchema = Joi.object({
  adminId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.empty': 'Admin ID is required',
      'string.pattern.base': 'Invalid Admin ID format'
    }),
  otp: Joi.string()
    .required()
    .length(6)
    .pattern(/^\d{6}$/)
    .messages({
      'string.empty': 'OTP is required',
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only numbers'
    })
});

export const resendOTPSchema = Joi.object({
  adminId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.empty': 'Admin ID is required',
      'string.pattern.base': 'Invalid Admin ID format'
    })
});

// Vendor request validation
export const vendorRequestSchema = Joi.object({
  shopName: Joi.string()
    .required()
    .trim()
    .min(2)
    .max(100)
    .messages({
      'string.empty': 'Shop name is required',
      'string.min': 'Shop name must be at least 2 characters',
      'string.max': 'Shop name cannot exceed 100 characters'
    }),
  shopDescription: Joi.string()
    .required()
    .trim()
    .min(10)
    .max(1000)
    .messages({
      'string.empty': 'Shop description is required',
      'string.min': 'Shop description must be at least 10 characters',
      'string.max': 'Shop description cannot exceed 1000 characters'
    }),
  shopAddress: Joi.string()
    .required()
    .trim()
    .min(10)
    .max(500)
    .messages({
      'string.empty': 'Shop address is required',
      'string.min': 'Shop address must be at least 10 characters',
      'string.max': 'Shop address cannot exceed 500 characters'
    }),
  shopPhone: Joi.string()
    .required()
    .pattern(/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
    .messages({
      'string.empty': 'Shop phone is required',
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  shopEmail: Joi.string()
    .required()
    .email()
    .messages({
      'string.empty': 'Shop email is required',
      'string.email': 'Please provide a valid email'
    }),
  businessType: Joi.string()
    .optional()
    .valid('individual', 'company', 'partnership')
    .default('individual')
    .messages({
      'any.only': 'Business type must be one of: individual, company, partnership'
    }),
  taxId: Joi.string()
    .optional()
    .trim()
    .max(50)
    .messages({
      'string.max': 'Tax ID cannot exceed 50 characters'
    }),
  documents: Joi.array()
    .optional()
    .items(Joi.string().uri())
    .messages({
      'array.items': 'Documents must be valid URLs'
    })
});

// Admin review validation
export const vendorReviewSchema = Joi.object({
  reviewNotes: Joi.string()
    .optional()
    .trim()
    .max(500)
    .messages({
      'string.max': 'Review notes cannot exceed 500 characters'
    }),
  rejectionReason: Joi.string()
    .when('$action', {
      is: 'reject',
      then: Joi.string().required().trim().min(5).max(500),
      otherwise: Joi.string().optional()
    })
    .messages({
      'string.empty': 'Rejection reason is required',
      'string.min': 'Rejection reason must be at least 5 characters',
      'string.max': 'Rejection reason cannot exceed 500 characters'
    })
});

// Query parameter validation
export const paginationSchema = Joi.object({
  page: Joi.number()
    .optional()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number()
    .optional()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  search: Joi.string()
    .optional()
    .trim()
    .max(100)
    .messages({
      'string.max': 'Search term cannot exceed 100 characters'
    }),
  status: Joi.string()
    .optional()
    .valid('pending', 'approved', 'rejected', 'all')
    .default('pending')
    .messages({
      'any.only': 'Status must be one of: pending, approved, rejected, all'
    })
});

// Enhanced validation middleware with context support
export const validateWithContext = (schema, context = {}) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      context: { ...context, $action: req.body.action }
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

// Query validation middleware
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { 
      abortEarly: false 
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Query validation failed',
        details: errors
      });
    }

    req.query = value;
    next();
  };
};
