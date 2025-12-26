import { configureStore } from '@reduxjs/toolkit'

import authReducer from '../features/auth/authSlice'
import tenantsReducer from '../features/tenants/tenantsSlice'
import productsReducer from '../features/products/productsSlice'
import categoriesReducer from '../features/categories/categoriesSlice'
import themeReducer from '../features/theme/themeSlice'
import ordersReducer from '../features/orders/ordersSlice'
import pageBuilderReducer from '../features/pageBuilder/pageBuilderSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tenants: tenantsReducer,
    products: productsReducer,
    categories: categoriesReducer,
    theme: themeReducer,
    orders: ordersReducer,
    pageBuilder: pageBuilderReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
})
