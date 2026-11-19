import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types/carwash';

const SUPABASE_CONFIG_STORAGE_KEY = 'naqaa_supabase_config_v1';

export function getSavedSupabaseConfig(): SupabaseConfig {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
      return {
        url: parsed.url?.trim() || envUrl,
        anonKey: parsed.anonKey?.trim() || envKey,
      };
    }
  } catch {
    // Ignore storage read errors
  }

  return { url: envUrl, anonKey: envKey };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(
    SUPABASE_CONFIG_STORAGE_KEY,
    JSON.stringify({
      url: config.url.trim(),
      anonKey: config.anonKey.trim(),
    })
  );
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
}

export function buildSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  const active = config ?? getSavedSupabaseConfig();
  if (!active.url || !active.anonKey) {
    return null;
  }
  try {
    return createClient(active.url, active.anonKey, {
      auth: {
        persistSession: false,
      },
    });
  } catch {
    return null;
  }
}

export async function testSupabaseConnection(
  config: SupabaseConfig
): Promise<{ ok: boolean; message: string }> {
  if (!config.url.startsWith('https://') || !config.anonKey) {
    return {
      ok: false,
      message: 'تأكد من إدخال رابط المشروع (https://...) ومفتاح Anon Key بشكل صحيح.',
    };
  }

  const client = buildSupabaseClient(config);
  if (!client) {
    return { ok: false, message: 'تعذر تهيئة عميل Supabase.' };
  }

  try {
    const { error } = await client.from('app_settings').select('id').limit(1);
    if (error) {
      if (error.message.includes('relation') || error.code === '42P01') {
        return {
          ok: false,
          message:
            'تم الاتصال بـ Supabase لكن الجداول غير موجودة بعد. انسخ كود SQL وشغّله في SQL Editor أولاً.',
        };
      }
      return { ok: false, message: `خطأ من Supabase: ${error.message}` };
    }
    return { ok: true, message: 'تم الاتصال بقاعدة بيانات Supabase بنجاح والجداول جاهزة!' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'تعذر الوصول إلى خادم Supabase.',
    };
  }
}
