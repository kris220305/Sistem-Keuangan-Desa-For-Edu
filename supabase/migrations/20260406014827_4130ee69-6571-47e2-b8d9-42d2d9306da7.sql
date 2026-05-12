
-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', true);

-- Create storage bucket for report PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('report-pdfs', 'report-pdfs', true);

-- Screenshots policies
CREATE POLICY "Anyone can upload screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Anyone can view screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

CREATE POLICY "Anyone can update screenshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'screenshots');

CREATE POLICY "Anyone can delete screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'screenshots');

-- Report PDFs policies
CREATE POLICY "Anyone can upload report pdfs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'report-pdfs');

CREATE POLICY "Anyone can view report pdfs"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-pdfs');

CREATE POLICY "Anyone can delete report pdfs"
ON storage.objects FOR DELETE
USING (bucket_id = 'report-pdfs');
