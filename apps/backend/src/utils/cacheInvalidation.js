import { deleteCache, deleteCachePattern } from '../config/redis.js';

export const PRODUCT_CACHE_PATTERNS = Object.freeze([
  'products:*',
  'search:products:*',
  'search:suggestions:*',
  'search:popular'
]);

export const CATEGORY_CACHE_PATTERNS = Object.freeze(['categories:*']);

export const invalidateProductCaches = (productId) => {
  const jobs = PRODUCT_CACHE_PATTERNS.map((pattern) => deleteCachePattern(pattern));

  if (productId) {
    jobs.push(deleteCache(`product:${productId}`));
  }

  return Promise.all(jobs);
};

export const invalidateCategoryCaches = () =>
  Promise.all(CATEGORY_CACHE_PATTERNS.map((pattern) => deleteCachePattern(pattern)));
