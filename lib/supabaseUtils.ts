import { supabase } from './supabaseClient';

// Upsert user by WorldCoin ID
export async function upsertUser({ worldcoin_id, email }: { worldcoin_id: string; email?: string }) {
  const { data, error } = await supabase
    .from('users')
    .upsert({ worldcoin_id, email }, { onConflict: 'worldcoin_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Create a new session for a user
export async function createSession(user_id: string) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ user_id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Insert a message (user or ai)
export async function insertMessage({ session_id, sender, content }: { session_id: string; sender: 'user' | 'ai'; content: string }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ session_id, sender, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Fetch all sessions for a user (most recent first)
export async function getSessionsForUser(user_id: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user_id)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Fetch all messages for a session (oldest first)
export async function getMessagesForSession(session_id: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
} 