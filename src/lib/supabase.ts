import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import Config from 'react-native-config';
import {trackedFetch} from './netMetrics';

const SUPABASE_URL = Config.SUPABASE_URL!;
const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Fase A0 (P9 lag 1): ALL HTTP fra klienten — REST/RPC/Auth/Storage-
  // signering — går gjennom netMetrics-fetchen og telles per skjerm.
  // Selve bildelastingen (native Image) går utenom JS og synes ikke her.
  global: {fetch: trackedFetch},
});
