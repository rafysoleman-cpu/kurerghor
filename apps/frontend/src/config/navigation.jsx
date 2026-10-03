import { User, Package, Heart, Settings, Store, Shield, Clock } from 'lucide-react'

/**
 * Single source of truth for every storefront navigation item.
 *
 * The header (desktop inline + mobile drawer) renders these same arrays, so a
 * link can never drift between breakpoints the way it did when Header.jsx and
 * MobileMenu.jsx each held their own hardcoded copy.
 */

const isActivePath = (to) => (pathname, search) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)

/**
 * Checks if Products link should be active.
 * Active ONLY when:
 * - pathname === '/products' AND
 * - No category query parameter is present
 */
export const isProductsActive = (pathname, search) => {
  if (pathname !== '/products') return false
  const urlParams = new URLSearchParams(search)
  return !urlParams.has('category')
}

/**
 * Checks if Categories dropdown should be active.
 * Active when:
 * - On /products with a category query parameter (e.g., /products?category=123)
 * - On /category/... routes (if they exist)
 */
export const isCategoriesActive = (pathname, search) => {
  // Check if on products page with category filter
  if (pathname === '/products' || pathname.startsWith('/products/')) {
    const urlParams = new URLSearchParams(search)
    return urlParams.has('category')
  }
  // Check if on category-specific routes
  if (pathname.startsWith('/category/')) {
    return true
  }
  return false
}

export const MAIN_NAV = [
  {
    id: 'home',
    label: 'Home',
    to: '/',
    icon: null,
    isActive: isActivePath('/')
  },
  {
    id: 'products',
    label: 'Products',
    to: '/products',
    icon: null,
    isActive: isProductsActive
  },
  {
    id: 'categories',
    label: 'Categories',
    to: null,
    icon: null,
    isDropdown: true,
    isActive: isCategoriesActive
  }
]

export const ACCOUNT_NAV = [
  { id: 'profile', label: 'Profile', to: '/profile', icon: User, isActive: isActivePath('/profile') },
  { id: 'orders', label: 'Orders', to: '/orders', icon: Package, isActive: isActivePath('/orders') },
  { id: 'wishlist', label: 'Wishlist', to: '/wishlist', icon: Heart, isActive: isActivePath('/wishlist') }
]

export const SETTINGS_NAV_ITEM = {
  id: 'settings',
  label: 'Settings',
  to: '/settings',
  icon: Settings,
  isActive: isActivePath('/settings')
}

/**
 * Resolves the role-aware panel link shown between Wishlist and Settings.
 *
 * Derived purely from store state, so it stays in sync automatically: when
 * `updateUserRole('vendor')` runs after approval, or when an admin approves a
 * request and the client refetches status, this returns the panel link with no
 * extra wiring. Returns null for a plain user, which is what hides the row.
 */
export const getRoleNavItem = ({ user, vendorRequestStatus }) => {
  if (user?.role === 'vendor') {
    return { id: 'vendor-panel', label: 'Vendor Panel', to: '/vendor/dashboard', icon: Store, isActive: isActivePath('/vendor/dashboard') }
  }

  if (user?.role === 'admin') {
    return { id: 'admin-panel', label: 'Admin Panel', to: '/admin', icon: Shield, isActive: isActivePath('/admin') }
  }

  if (vendorRequestStatus?.hasRequest) {
    const { status } = vendorRequestStatus.request

    if (status === 'pending') {
      return {
        id: 'vendor-pending',
        label: 'Application Pending',
        to: '/become-vendor',
        icon: Clock,
        isDisabled: true,
        isActive: isActivePath('/become-vendor')
      }
    }

    if (status === 'rejected') {
      return {
        id: 'vendor-rejected',
        label: 'Become a Vendor',
        to: '/become-vendor',
        icon: Store,
        isActive: isActivePath('/become-vendor')
      }
    }
  }

  return { id: 'become-vendor', label: 'Become a Vendor', to: '/become-vendor', icon: Store, isActive: isActivePath('/become-vendor') }
}

/**
 * Full account section in spec order: Profile, Orders, Wishlist, role panel
 * (omitted for plain users), then Settings last.
 *
 * Settings is returned separately from `items` on purpose. The theme quick
 * toggle must sit between the role panel and Settings on both the desktop
 * popover and the mobile drawer, and exposing the split point as data lets
 * both surfaces place it identically — rather than each hardcoding an index,
 * which is how the two menus drifted apart in the first place.
 *
 * Callers render: items → theme toggle → settingsItem.
 */
export const buildAccountNav = ({ user, vendorRequestStatus }) => {
  const items = [...ACCOUNT_NAV]
  const roleItem = getRoleNavItem({ user, vendorRequestStatus })

  if (roleItem) items.push(roleItem)

  return { items, settingsItem: SETTINGS_NAV_ITEM }
}