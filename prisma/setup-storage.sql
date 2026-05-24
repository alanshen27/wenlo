-- Run once in the Supabase SQL editor (Storage → documents bucket).
-- Uploads/deletes from the app use the service role and bypass RLS; these
-- policies still protect direct client access if you add signed URLs later.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

-- Paths are stored as: {userId}/{libraryId}/{timestamp}-{filename}

DROP POLICY IF EXISTS "documents: users read own files" ON storage.objects;
CREATE POLICY "documents: users read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "documents: users upload own files" ON storage.objects;
CREATE POLICY "documents: users upload own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "documents: users delete own files" ON storage.objects;
CREATE POLICY "documents: users delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
