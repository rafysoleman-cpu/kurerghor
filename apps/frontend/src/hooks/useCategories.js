import { useQuery } from 'react-query'
import { categoryAPI } from '../services/api'
import { isDemoMode, getDemoCategories } from '../demo/services/index.js'

export const CATEGORIES_QUERY_KEY = 'categories'

/**
 * Normalises the categories response to a plain array.
 *
 * The live API answers GET /categories with `{ success, data: [...] }`, and the
 * axios response interceptor returns the whole response object, so under
 * react-query the array lives at `response.data.data`. Demo mode returns
 * `{ data: [...] }` instead. Consumers should not need to know either shape,
 * so we flatten it here once.
 */
const selectCategories = (response) => {
  const payload = response?.data?.data ?? response?.data
  return Array.isArray(payload) ? payload : []
}

/**
 * Shared categories query. Every consumer (header menu, home, products,
 * search) uses this so they share one cache entry under 'categories' and can
 * never disagree about the response shape.
 */
export const useCategories = (options = {}) =>
  useQuery(
    CATEGORIES_QUERY_KEY,
    () => (isDemoMode() ? getDemoCategories() : categoryAPI.getCategories()),
    {
      staleTime: 30 * 60 * 1000,
      select: selectCategories,
      ...options
    }
  )