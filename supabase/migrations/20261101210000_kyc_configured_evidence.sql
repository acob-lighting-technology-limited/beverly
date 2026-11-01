-- Enforce saved KYC evidence policy inside the submission transaction.
create or replace function public.submit_kyc_evidence_review(
  p_subject_type text,
  p_subject_id uuid,
  p_requested_tier integer,
  p_submitted_by uuid,
  p_submission jsonb default '{}'::jsonb
) returns public.kyc_review_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_tier integer;
  v_request public.kyc_review_requests;
  v_document_count integer := 0;
  v_expected_documents integer := 0;
  v_identity_count integer := 0;
  v_selfie_count integer := 0;
  v_address_count integer := 0;
  v_created boolean := false;
  v_policy jsonb;
  v_requirement jsonb;
begin
  if p_subject_type = 'customer' then
    select kyc_tier into v_current_tier from public.customers where id = p_subject_id for update;
  elsif p_subject_type = 'vendor' then
    select kyc_tier into v_current_tier from public.vendor_organizations where id = p_subject_id for update;
  else
    raise exception using errcode = '22023', message = 'invalid_subject_type';
  end if;
  if v_current_tier is null then
    raise exception using errcode = 'P0002', message = 'kyc_subject_not_found';
  end if;
  if p_requested_tier <> v_current_tier + 1 or p_requested_tier not between 1 and 2 then
    raise exception using errcode = '22023', message = 'kyc_tier_must_be_sequential';
  end if;

  select value into v_policy from public.system_settings where key = 'kyc_policy' for share;
  if v_policy is null then
    v_policy := '{"customer_enabled":true,"vendor_enabled":true,"customer":{"tier1":{"identity":["national_id","voters_card","passport","drivers_license"],"selfie":true,"address":[]},"tier2":{"identity":["national_id","voters_card","passport","drivers_license"],"selfie":true,"address":["utility_bill","bank_statement"]}},"vendor":{"tier2":{"identity":["national_id","voters_card","passport","drivers_license"],"selfie":true,"address":["utility_bill","bank_statement"]}}}'::jsonb;
  end if;
  if (v_policy ->> (p_subject_type || '_enabled'))::boolean is distinct from true then
    raise exception using errcode = '22023', message = 'kyc_disabled';
  end if;
  v_requirement := case when p_subject_type = 'vendor' then v_policy #> '{vendor,tier2}'
    when p_requested_tier = 1 then v_policy #> '{customer,tier1}'
    else v_policy #> '{customer,tier2}' end;
  if jsonb_typeof(v_requirement -> 'identity') is distinct from 'array'
    or jsonb_typeof(v_requirement -> 'selfie') is distinct from 'boolean'
    or jsonb_typeof(v_requirement -> 'address') is distinct from 'array'
    or (jsonb_array_length(v_requirement -> 'identity') = 0 and not (v_requirement ->> 'selfie')::boolean and jsonb_array_length(v_requirement -> 'address') = 0) then
    raise exception using errcode = '22023', message = 'kyc_policy_invalid';
  end if;

  v_expected_documents := jsonb_array_length(coalesce(p_submission -> 'document_ids', '[]'::jsonb));
  if v_expected_documents < 1 then
    raise exception using errcode = '22023', message = 'kyc_documents_required';
  end if;
  select * into v_request from public.kyc_review_requests
  where status = 'pending'
    and ((p_subject_type = 'customer' and customer_id = p_subject_id)
      or (p_subject_type = 'vendor' and vendor_organization_id = p_subject_id))
  for update;
  if found then
    update public.kyc_review_requests
    set submission_json = p_submission, submitted_by = p_submitted_by, submitted_at = now(), updated_at = now()
    where id = v_request.id returning * into v_request;
  else
    insert into public.kyc_review_requests (
      subject_type, customer_id, vendor_organization_id, current_tier, requested_tier, submission_json, submitted_by
    ) values (
      p_subject_type,
      case when p_subject_type = 'customer' then p_subject_id end,
      case when p_subject_type = 'vendor' then p_subject_id end,
      v_current_tier, p_requested_tier, p_submission, p_submitted_by
    ) returning * into v_request;
    v_created := true;
  end if;

  update public.kyc_documents
  set review_request_id = v_request.id, updated_at = now()
  where id in (select value::uuid from jsonb_array_elements_text(p_submission -> 'document_ids'))
    and uploaded_at is not null
    and (review_request_id is null or review_request_id = v_request.id)
    and kyc_tier = p_requested_tier
    and ((p_subject_type = 'customer' and customer_id = p_subject_id and vendor_organization_id is null)
      or (p_subject_type = 'vendor' and vendor_organization_id = p_subject_id and customer_id is null));
  get diagnostics v_document_count = row_count;
  if v_document_count <> v_expected_documents then
    raise exception using errcode = '22023', message = 'kyc_documents_invalid_or_already_used';
  end if;
  select count(*) filter (where (v_requirement -> 'identity') ? doc_type),
         count(*) filter (where doc_type = 'selfie'),
         count(*) filter (where (v_requirement -> 'address') ? doc_type)
  into v_identity_count, v_selfie_count, v_address_count
  from public.kyc_documents
  where review_request_id = v_request.id
    and id in (select value::uuid from jsonb_array_elements_text(p_submission -> 'document_ids'));
  if jsonb_array_length(v_requirement -> 'identity') > 0 and v_identity_count < 1 then
    raise exception using errcode = '22023', message = 'kyc_identity_required';
  end if;
  if (v_requirement ->> 'selfie')::boolean and v_selfie_count < 1 then
    raise exception using errcode = '22023', message = 'kyc_selfie_required';
  end if;
  if jsonb_array_length(v_requirement -> 'address') > 0 and v_address_count < 1 then
    raise exception using errcode = '22023', message = 'kyc_address_evidence_required';
  end if;

  if p_subject_type = 'customer' then
    update public.customers
    set kyc_status = 'pending',
        kyc_data = coalesce(kyc_data, '{}'::jsonb) || jsonb_build_object(
          'pending', p_submission || jsonb_build_object('requested_tier', p_requested_tier, 'submitted_at', now())
        ), updated_at = now()
    where id = p_subject_id;
  else
    update public.vendor_organizations
    set kyc_status = 'pending',
        kyc_data = coalesce(kyc_data, '{}'::jsonb) || jsonb_build_object(
          'pending', p_submission || jsonb_build_object('requested_tier', p_requested_tier, 'submitted_at', now())
        ), updated_at = now()
    where id = p_subject_id;
  end if;
  if v_created then
    insert into public.wallet_audit_log (
      actor_user_id, actor_type, action, target_type, target_id, before_json, after_json
    ) values (
      p_submitted_by, p_subject_type, 'kyc.tier' || p_requested_tier::text || '.review_requested',
      p_subject_type, p_subject_id::text,
      jsonb_build_object('kyc_tier', v_current_tier),
      jsonb_build_object('requested_tier', p_requested_tier, 'review_request_id', v_request.id)
    );
  end if;
  return v_request;
end;
$$;


create or replace function public.submit_kyc_enhanced_review(
  p_subject_type text, p_subject_id uuid, p_requested_tier integer,
  p_submitted_by uuid, p_submission jsonb default '{}'::jsonb
) returns public.kyc_review_requests
language plpgsql security definer set search_path = public as $$
begin
  if p_requested_tier <> 2 then
    raise exception using errcode = '22023', message = 'enhanced_review_requires_tier_2';
  end if;
  return public.submit_kyc_evidence_review(p_subject_type, p_subject_id, p_requested_tier, p_submitted_by, p_submission);
end;
$$;

revoke all on function public.submit_kyc_evidence_review(text, uuid, integer, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.submit_kyc_enhanced_review(text, uuid, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_kyc_evidence_review(text, uuid, integer, uuid, jsonb) to service_role;
grant execute on function public.submit_kyc_enhanced_review(text, uuid, integer, uuid, jsonb) to service_role;
