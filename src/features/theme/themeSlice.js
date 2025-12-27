import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { fetchThemeByTenantId, upsertTheme } from '../../lib/supabaseApi'

const PERSIST_KEY = 'state.theme'

const defaultTheme = {
  primary: '#111827',
  accent: '#f59e0b',
  background: '#ffffff',
  text: '#111827',
  radius: '12px',
}

const initialState = loadJson(PERSIST_KEY, {
  themeByTenantId: {
    tenant_demo: defaultTheme,
  },
})

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

export const fetchTenantTheme = createAsyncThunk('theme/fetchTenantTheme', async (tenantId) => {
  if (!isSupabaseConfigured) return null
  const row = await fetchThemeByTenantId(tenantId)
  return { tenantId, row }
})

export const saveTenantTheme = createAsyncThunk('theme/saveTenantTheme', async ({ tenantId, theme }) => {
  console.log('[themeSlice] saveTenantTheme llamado con:', { tenantId, theme })
  if (!isSupabaseConfigured) {
    console.log('[themeSlice] Modo MOCK - sin Supabase')
    return { tenantId, row: null, theme }
  }
  const row = await upsertTheme({ tenantId, theme })
  console.log('[themeSlice] Respuesta de Supabase:', row)
  return { tenantId, row }
})

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    upsertTenantTheme(state, action) {
      const { tenantId, theme } = action.payload
      state.themeByTenantId[tenantId] = {
        ...(state.themeByTenantId[tenantId] || defaultTheme),
        ...theme,
      }
      persist(state)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenantTheme.fulfilled, (state, action) => {
        const payload = action.payload
        if (!payload) return
        const { tenantId, row } = payload
        if (!tenantId || !row) return
        state.themeByTenantId[tenantId] = {
          primary: row.primary_color,
          accent: row.accent_color,
          background: row.background_color,
          text: row.text_color,
          radius: row.radius,
          productCardLayout: row.product_card_layout,
          cardBg: row.card_bg,
          cardText: row.card_text,
          cardDesc: row.card_desc,
          cardPrice: row.card_price,
          cardButton: row.card_button,
          heroStyle: row.hero_style,
          heroSlides: row.hero_slides,
          heroTitlePosition: row.hero_title_position,
          heroOverlayOpacity: row.hero_overlay_opacity,
          heroShowTitle: row.hero_show_title,
          heroShowSubtitle: row.hero_show_subtitle,
          heroShowCta: row.hero_show_cta,
          heroCarouselButtonStyle: row.hero_carousel_button_style,
        }
        persist(state)
      })
      .addCase(saveTenantTheme.fulfilled, (state, action) => {
        const payload = action.payload
        console.log('[themeSlice] saveTenantTheme.fulfilled payload:', payload)
        if (!payload) return
        const { tenantId, row, theme } = payload
        if (!tenantId) return
        if (row) {
          console.log('[themeSlice] Usando row de Supabase')
          state.themeByTenantId[tenantId] = {
            primary: row.primary_color,
            accent: row.accent_color,
            background: row.background_color,
            text: row.text_color,
            radius: row.radius,
            productCardLayout: row.product_card_layout,
            cardBg: row.card_bg,
            cardText: row.card_text,
            cardDesc: row.card_desc,
            cardPrice: row.card_price,
            cardButton: row.card_button,
            heroStyle: row.hero_style,
            heroSlides: row.hero_slides,
            heroTitlePosition: row.hero_title_position,
            heroOverlayOpacity: row.hero_overlay_opacity,
            heroShowTitle: row.hero_show_title,
            heroShowSubtitle: row.hero_show_subtitle,
            heroShowCta: row.hero_show_cta,
            heroCarouselButtonStyle: row.hero_carousel_button_style,
          }
        } else if (theme) {
          console.log('[themeSlice] Usando theme local (modo MOCK)')
          state.themeByTenantId[tenantId] = {
            ...(state.themeByTenantId[tenantId] || defaultTheme),
            ...theme,
          }
        }
        console.log('[themeSlice] Nuevo state para', tenantId, ':', state.themeByTenantId[tenantId])
        persist(state)
      })
  },
})

export const { upsertTenantTheme } = themeSlice.actions

export const selectThemeForTenant = (tenantId) => (state) =>
  state.theme.themeByTenantId[tenantId] || defaultTheme

export default themeSlice.reducer
