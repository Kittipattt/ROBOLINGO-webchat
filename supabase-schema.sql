-- ==============================================================================
-- ROBO LINGO WebChat - Supabase Cloud Database Schema & Storage Setup
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ==============================================================================

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'LINE User',
  picture_url TEXT,
  status_message TEXT,
  last_message TEXT DEFAULT '',
  last_message_at BIGINT DEFAULT 0,
  unread_count INT DEFAULT 0,
  last_sender TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index for ordering conversations by latest activity
CREATE INDEX IF NOT EXISTS idx_users_last_message_at ON public.users (last_message_at DESC);

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'agent')),
  text TEXT DEFAULT '',
  image_url TEXT,
  sticker_url TEXT,
  package_id TEXT,
  sticker_id TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'sticker')),
  created_at BIGINT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'error')),
  inserted_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index for fast user message queries sorted by creation time
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON public.messages (user_id, created_at ASC);

-- 3. Create Quick Replies Table
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at BIGINT DEFAULT 0
);

-- Seed default quick replies if table is empty
INSERT INTO public.quick_replies (id, text, category, created_at)
VALUES 
  ('qr_1', 'สวัสดีครับ มีอะไรให้เราช่วยเหลือไหมครับ? 🙏', 'general', 1),
  ('qr_2', 'ยินดีให้บริการตลอด 24 ชม. ครับ', 'general', 2),
  ('qr_3', 'ทางเราได้รับข้อมูลแล้ว จะรีบตรวจสอบให้ทันทีครับ ⏳', 'general', 3),
  ('qr_4', 'ขอบคุณที่ติดต่อ ROBO LINGO ครับ ✨', 'general', 4)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS) and grant service/anon access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- Allow full access for service_role and authenticated/anon clients with API key
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Allow all access to users') THEN
    CREATE POLICY "Allow all access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Allow all access to messages') THEN
    CREATE POLICY "Allow all access to messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quick_replies' AND policyname = 'Allow all access to quick_replies') THEN
    CREATE POLICY "Allow all access to quick_replies" ON public.quick_replies FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Create Storage Bucket for Chat Attachments (Slips, Photos, Catalog Images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for chat-attachments') THEN
    CREATE POLICY "Public Access for chat-attachments" ON storage.objects
    FOR ALL USING (bucket_id = 'chat-attachments')
    WITH CHECK (bucket_id = 'chat-attachments');
  END IF;
END $$;
