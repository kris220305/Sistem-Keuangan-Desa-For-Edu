
CREATE POLICY "Anyone can delete report_submissions"
ON public.report_submissions
FOR DELETE
USING (true);

CREATE POLICY "Anyone can update report_submissions"
ON public.report_submissions
FOR UPDATE
USING (true);
