import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loadJson, saveJson } from '../../shared/storage'
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'

const PERSIST_KEY = 'state.pageBuilder'

const initialState = loadJson(PERSIST_KEY, {
  // Configuración de página por tenantId
  pageConfigByTenantId: {},
  // Widgets por tenantId
  widgetsByTenantId: {},
  // Templates disponibles
  templates: [],
  // Estado de carga
  status: 'idle',
  error: null,
})

function persist(state) {
  saveJson(PERSIST_KEY, state)
}

// ============================================================================
// Thunks
// ============================================================================

export const fetchPageConfig = createAsyncThunk(
  'pageBuilder/fetchPageConfig',
  async ({ tenantId, pageType = 'storefront' }) => {
    if (!isSupabaseConfigured) return null
    
    const { data, error } = await supabase
      .from('tenant_page_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('page_type', pageType)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return { tenantId, pageType, config: data }
  }
)

export const savePageConfig = createAsyncThunk(
  'pageBuilder/savePageConfig',
  async ({ tenantId, pageType = 'storefront', blocks, settings, isPublished }) => {
    if (!isSupabaseConfigured) {
      return { tenantId, pageType, config: { blocks, settings, is_published: isPublished } }
    }
    
    const { data, error } = await supabase
      .from('tenant_page_config')
      .upsert({
        tenant_id: tenantId,
        page_type: pageType,
        blocks,
        settings,
        is_published: isPublished,
      }, { onConflict: 'tenant_id,page_type' })
      .select()
      .single()
    
    if (error) throw error
    return { tenantId, pageType, config: data }
  }
)

export const fetchWidgets = createAsyncThunk(
  'pageBuilder/fetchWidgets',
  async (tenantId) => {
    if (!isSupabaseConfigured) return { tenantId, widgets: [] }
    
    const { data, error } = await supabase
      .from('tenant_widgets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true })
    
    if (error) throw error
    return { tenantId, widgets: data || [] }
  }
)

export const saveWidget = createAsyncThunk(
  'pageBuilder/saveWidget',
  async ({ tenantId, widget }) => {
    if (!isSupabaseConfigured) {
      const mockWidget = { ...widget, id: widget.id || crypto.randomUUID() }
      return { tenantId, widget: mockWidget }
    }
    
    const payload = {
      tenant_id: tenantId,
      widget_type: widget.widget_type,
      title: widget.title,
      content: widget.content,
      sort_order: widget.sort_order ?? 0,
      is_visible: widget.is_visible ?? true,
    }
    
    if (widget.id) {
      payload.id = widget.id
    }
    
    const { data, error } = await supabase
      .from('tenant_widgets')
      .upsert(payload)
      .select()
      .single()
    
    if (error) throw error
    return { tenantId, widget: data }
  }
)

export const deleteWidget = createAsyncThunk(
  'pageBuilder/deleteWidget',
  async ({ tenantId, widgetId }) => {
    if (!isSupabaseConfigured) {
      return { tenantId, widgetId }
    }
    
    const { error } = await supabase
      .from('tenant_widgets')
      .delete()
      .eq('id', widgetId)
    
    if (error) throw error
    return { tenantId, widgetId }
  }
)

export const reorderWidgets = createAsyncThunk(
  'pageBuilder/reorderWidgets',
  async ({ tenantId, widgetIds }) => {
    if (!isSupabaseConfigured) {
      return { tenantId, widgetIds }
    }
    
    // Actualizar sort_order de cada widget
    const updates = widgetIds.map((id, index) => 
      supabase
        .from('tenant_widgets')
        .update({ sort_order: index })
        .eq('id', id)
    )
    
    await Promise.all(updates)
    return { tenantId, widgetIds }
  }
)

export const fetchTemplates = createAsyncThunk(
  'pageBuilder/fetchTemplates',
  async () => {
    if (!isSupabaseConfigured) {
      // Plantillas mock
      return [
        {
          id: 'tpl_1',
          name: 'Restaurante Moderno',
          description: 'Diseño limpio y moderno',
          category: 'restaurant',
          tier_required: 'free',
          theme_config: { primary_color: '#0f172a', accent_color: '#f97316', card_style: 'glass' },
          blocks_config: [{ type: 'hero' }, { type: 'products_grid' }],
        },
        {
          id: 'tpl_2',
          name: 'Cafetería Premium',
          description: 'Estilo cálido con carrusel',
          category: 'cafe',
          tier_required: 'premium',
          theme_config: { primary_color: '#78350f', accent_color: '#d97706', card_style: 'solid' },
          blocks_config: [{ type: 'hero' }, { type: 'products_carousel' }, { type: 'testimonials' }],
        },
      ]
    }
    
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .order('tier_required', { ascending: true })
    
    if (error) throw error
    return data || []
  }
)

export const applyTemplate = createAsyncThunk(
  'pageBuilder/applyTemplate',
  async ({ tenantId, template }, { dispatch }) => {
    // Aplicar tema
    if (template.theme_config) {
      // Esto se integrará con el themeSlice existente
    }
    
    // Aplicar configuración de bloques
    if (template.blocks_config) {
      await dispatch(savePageConfig({
        tenantId,
        pageType: 'storefront',
        blocks: template.blocks_config,
        settings: {},
        isPublished: false,
      }))
    }
    
    return { tenantId, template }
  }
)

// ============================================================================
// Slice
// ============================================================================

const pageBuilderSlice = createSlice({
  name: 'pageBuilder',
  initialState,
  reducers: {
    // Actualizar config localmente (para preview en tiempo real)
    updateLocalPageConfig(state, action) {
      const { tenantId, pageType = 'storefront', blocks, settings } = action.payload
      const key = `${tenantId}:${pageType}`
      state.pageConfigByTenantId[key] = {
        ...state.pageConfigByTenantId[key],
        blocks,
        settings,
      }
    },
    // Actualizar widget localmente
    updateLocalWidget(state, action) {
      const { tenantId, widget } = action.payload
      const widgets = state.widgetsByTenantId[tenantId] || []
      const index = widgets.findIndex(w => w.id === widget.id)
      if (index >= 0) {
        widgets[index] = { ...widgets[index], ...widget }
      } else {
        widgets.push(widget)
      }
      state.widgetsByTenantId[tenantId] = widgets
      persist(state)
    },
    // Reordenar widgets localmente (drag & drop)
    reorderLocalWidgets(state, action) {
      const { tenantId, fromIndex, toIndex } = action.payload
      const widgets = [...(state.widgetsByTenantId[tenantId] || [])]
      const [removed] = widgets.splice(fromIndex, 1)
      widgets.splice(toIndex, 0, removed)
      // Actualizar sort_order
      widgets.forEach((w, i) => { w.sort_order = i })
      state.widgetsByTenantId[tenantId] = widgets
      persist(state)
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPageConfig
      .addCase(fetchPageConfig.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchPageConfig.fulfilled, (state, action) => {
        state.status = 'idle'
        if (action.payload?.config) {
          const { tenantId, pageType, config } = action.payload
          const key = `${tenantId}:${pageType}`
          state.pageConfigByTenantId[key] = config
          persist(state)
        }
      })
      .addCase(fetchPageConfig.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
      // savePageConfig
      .addCase(savePageConfig.fulfilled, (state, action) => {
        if (action.payload?.config) {
          const { tenantId, pageType, config } = action.payload
          const key = `${tenantId}:${pageType}`
          state.pageConfigByTenantId[key] = config
          persist(state)
        }
      })
      // fetchWidgets
      .addCase(fetchWidgets.fulfilled, (state, action) => {
        if (action.payload) {
          const { tenantId, widgets } = action.payload
          state.widgetsByTenantId[tenantId] = widgets
          persist(state)
        }
      })
      // saveWidget
      .addCase(saveWidget.fulfilled, (state, action) => {
        if (action.payload?.widget) {
          const { tenantId, widget } = action.payload
          const widgets = state.widgetsByTenantId[tenantId] || []
          const index = widgets.findIndex(w => w.id === widget.id)
          if (index >= 0) {
            widgets[index] = widget
          } else {
            widgets.push(widget)
          }
          state.widgetsByTenantId[tenantId] = widgets
          persist(state)
        }
      })
      // deleteWidget
      .addCase(deleteWidget.fulfilled, (state, action) => {
        if (action.payload) {
          const { tenantId, widgetId } = action.payload
          state.widgetsByTenantId[tenantId] = (state.widgetsByTenantId[tenantId] || [])
            .filter(w => w.id !== widgetId)
          persist(state)
        }
      })
      // reorderWidgets
      .addCase(reorderWidgets.fulfilled, (state, action) => {
        if (action.payload) {
          const { tenantId, widgetIds } = action.payload
          const widgets = state.widgetsByTenantId[tenantId] || []
          // Reordenar según el nuevo orden
          const reordered = widgetIds.map((id, index) => {
            const widget = widgets.find(w => w.id === id)
            return widget ? { ...widget, sort_order: index } : null
          }).filter(Boolean)
          state.widgetsByTenantId[tenantId] = reordered
          persist(state)
        }
      })
      // fetchTemplates
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.templates = action.payload || []
        persist(state)
      })
  },
})

export const {
  updateLocalPageConfig,
  updateLocalWidget,
  reorderLocalWidgets,
} = pageBuilderSlice.actions

// Selectores
export const selectPageConfig = (tenantId, pageType = 'storefront') => (state) =>
  state.pageBuilder.pageConfigByTenantId[`${tenantId}:${pageType}`]

export const selectWidgets = (tenantId) => (state) =>
  state.pageBuilder.widgetsByTenantId[tenantId] || []

export const selectTemplates = (state) => state.pageBuilder.templates

export const selectPageBuilderStatus = (state) => state.pageBuilder.status

export default pageBuilderSlice.reducer
