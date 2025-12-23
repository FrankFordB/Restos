import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseConfigured = Boolean(supabase)

// Diagnóstico (no imprime secrets): útil para confirmar si Vite está leyendo .env
if (import.meta.env.DEV) {
	try {
		const host = url ? new URL(url).host : null
		// eslint-disable-next-line no-console
		console.info('[Supabase]', { configured: Boolean(url && anonKey), hasUrl: Boolean(url), hasAnonKey: Boolean(anonKey), host })
	} catch {
		// eslint-disable-next-line no-console
		console.info('[Supabase]', { configured: Boolean(url && anonKey), hasUrl: Boolean(url), hasAnonKey: Boolean(anonKey) })
	}
}
