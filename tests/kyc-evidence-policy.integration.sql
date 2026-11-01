-- Run inside a transaction that is rolled back after this block.
do $$
declare
  vendor_id uuid;
  second_vendor_id uuid;
  doc_id uuid;
  second_doc_id uuid;
  customer_id uuid;
  customer_doc_id uuid;
  request_row public.kyc_review_requests;
  disabled_blocked boolean := false;
  missing_selfie_blocked boolean := false;
begin
  insert into public.vendor_organizations (legal_name, status) values ('KYC test only', 'approved') returning id into vendor_id;
  insert into public.kyc_documents (vendor_organization_id, doc_type, kyc_tier, storage_path, mime_type, size_bytes, uploaded_at)
    values (vendor_id, 'national_id', 1, 'test-only', 'image/png', 1, now()) returning id into doc_id;

  update public.system_settings set value = jsonb_set(value, '{vendor_enabled}', 'false'::jsonb) where key = 'kyc_policy';
  begin
    perform public.submit_kyc_evidence_review('vendor', vendor_id, 1, null, jsonb_build_object('document_ids', jsonb_build_array(doc_id)));
  exception when sqlstate '22023' then
    disabled_blocked := sqlerrm = 'kyc_disabled';
  end;
  if not disabled_blocked then raise exception 'disabled policy was not enforced'; end if;

  update public.system_settings set value = jsonb_set(jsonb_set(value, '{vendor_enabled}', 'true'::jsonb), '{vendor,tier2}', '{"identity":["national_id"],"selfie":true,"address":[]}'::jsonb) where key = 'kyc_policy';
  begin
    perform public.submit_kyc_evidence_review('vendor', vendor_id, 1, null, jsonb_build_object('document_ids', jsonb_build_array(doc_id)));
  exception when sqlstate '22023' then
    missing_selfie_blocked := sqlerrm = 'kyc_selfie_required';
  end;
  if not missing_selfie_blocked then raise exception 'required selfie was not enforced'; end if;

  update public.system_settings set value = jsonb_set(value, '{vendor,tier2,selfie}', 'false'::jsonb) where key = 'kyc_policy';
  select * into request_row from public.submit_kyc_evidence_review('vendor', vendor_id, 1, null, jsonb_build_object('document_ids', jsonb_build_array(doc_id)));
  if request_row.requested_tier <> 1 then raise exception 'tier one submission failed'; end if;

  insert into public.vendor_organizations (legal_name, status, kyc_tier) values ('KYC test only two', 'approved', 1) returning id into second_vendor_id;
  insert into public.kyc_documents (vendor_organization_id, doc_type, kyc_tier, storage_path, mime_type, size_bytes, uploaded_at)
    values (second_vendor_id, 'national_id', 2, 'test-only-two', 'image/png', 1, now()) returning id into second_doc_id;
  select * into request_row from public.submit_kyc_enhanced_review('vendor', second_vendor_id, 2, null, jsonb_build_object('document_ids', jsonb_build_array(second_doc_id)));
  if request_row.requested_tier <> 2 then raise exception 'tier two submission failed'; end if;

  insert into public.customers (name) values ('KYC customer test only') returning id into customer_id;
  insert into public.kyc_documents (customer_id, doc_type, kyc_tier, storage_path, mime_type, size_bytes, uploaded_at)
    values (customer_id, 'selfie', 1, 'customer-test-only', 'image/png', 1, now()) returning id into customer_doc_id;
  update public.system_settings set value = jsonb_set(jsonb_set(value, '{customer_enabled}', 'true'::jsonb), '{customer,tier1}', '{"identity":[],"selfie":true,"address":[]}'::jsonb) where key = 'kyc_policy';
  select * into request_row from public.submit_kyc_evidence_review('customer', customer_id, 1, null, jsonb_build_object('document_ids', jsonb_build_array(customer_doc_id)));
  if request_row.requested_tier <> 1 then raise exception 'customer submission failed'; end if;
end;
$$;
