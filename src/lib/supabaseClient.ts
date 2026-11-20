import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types/carwash';

const SUPABASE_CONFIG_STORAGE_KEY = 'naqaa_supabase_config_v1';

const DEFAULT_SUPABASE_URL = 'https://upfcpsjsppieqyejykdf.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_BrF2O7crCpGoWCbHgLtYIQ_50lkrXIJ';

export function normalizeSupabaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

export function getSavedSupabaseConfig(): SupabaseConfig {
  const envUrl = normalizeSupabaseUrl(
    import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
  );
  const envKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();

  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
      return {
        url: normalizeSupabaseUrl(parsed.url || '') || envUrl,
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
      url: normalizeSupabaseUrl(config.url),
      anonKey: config.anonKey.trim(),
    })
  );
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
}

export function buildSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  const active = config
    ? {
        url: normalizeSupabaseUrl(config.url),
        anonKey: config.anonKey.trim(),
      }
    : getSavedSupabaseConfig();
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
  const normalizedUrl = normalizeSupabaseUrl(config.url);
  const cleanKey = config.anonKey.trim();

  if (!normalizedUrl.startsWith('https://') || !cleanKey) {
    return {
      ok: false,
      message:
        'تأكد من إدخال رابط المشروع (https://...) ومفتاح Publishable Key (أو Anon Key) بشكل صحيح.',
    };
  }

  if (cleanKey.startsWith('sb_secret_')) {
    return {
      ok: false,
      message:
        'تحذير أمني: هذا مفتاح Secret Key مخصص للسيرفر فقط. استخدم Publishable Key (sb_publishable_...) أو Legacy anon key.',
    };
  }

  const client = buildSupabaseClient({ url: normalizedUrl, anonKey: cleanKey });
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
      if (
        error.code === '42501' ||
        error.message.toLowerCase().includes('permission denied')
      ) {
        return {
          ok: false,
          message:
            'تم الوصول لقاعدة البيانات والجداول موجودة، لكن ينقصها صلاحيات GRANT للدور anon. شغّل كود إصلاح الصلاحيات بالأسفل في SQL Editor.',
        };
      }
      if (
        error.message.toLowerCase().includes('invalid api key') ||
        error.message.toLowerCase().includes('jwt')
      ) {
        return {
          ok: false,
          message:
            'المفتاح غير صحيح. تأكد من نسخ Publishable key (sb_publishable_...) أو Legacy anon key من Project Settings → API Keys.',
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
