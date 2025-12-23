import { configureStore } from '@reduxjs/toolkit'

import authReducer from '../features/auth/authSlice'
import tenantsReducer from '../features/tenants/tenantsSlice'
import productsReducer from '../features/products/productsSlice'
import themeReducer from '../features/theme/themeSlice'
import ordersReducer from '../features/orders/ordersSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tenants: tenantsReducer,
    products: productsReducer,
    theme: themeReducer,
    orders: ordersReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
})
