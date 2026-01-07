// Re-export from centralized product constants for backward compatibility
// All LQS-specific code can continue importing from this file
export { 
  EXCLUDED_PRODUCTS as LQS_EXCLUDED_PRODUCTS,
  isExcludedProduct,
  filterCountableQuotes,
  filterCountableSales,
} from './product-constants';
