import { configureStore } from '@reduxjs/toolkit'

import authReducer from '../features/auth/authSlice'
import tenantsReducer from '../features/tenants/tenantsSlice'
import productsReducer from '../features/products/productsSlice'
import themeReducer from '../features/theme/themeSlice'
import ordersReducer from '../features/orders/ordersSlice'
import pageBuilderReducer from '../features/pageBuilder/pageBuilderSlice'
import categoriesReducer from '../features/categories/categoriesSlice'
import extrasReducer from '../features/extras/extrasSlice'
import referralsReducer from '../features/referrals/referralsSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tenants: tenantsReducer,
    products: productsReducer,
    theme: themeReducer,
    orders: ordersReducer,
    pageBuilder: pageBuilderReducer,
    categories: categoriesReducer,
    extras: extrasReducer,
    referrals: referralsReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ 
    serializableCheck: false,
    immutableCheck: { warnAfter: 128 }, // Aumentar threshold para estados grandes
  }),
})
