DELETE FROM public.column_transfers a
WHERE a.transfer_type = 'book'
  AND a.transfer_id NOT LIKE '%:in'
  AND a.transfer_id NOT LIKE '%:out'
  AND EXISTS (SELECT 1 FROM public.column_transfers b WHERE b.transfer_id = a.transfer_id || ':out');