CREATE INDEX notes_search ON morrow.notes USING gin(to_tsvector('simple',body));
CREATE INDEX notes_tenant_application ON morrow.notes(org_id,application_id,created_at DESC);
CREATE INDEX interviews_tenant_application ON morrow.interviews(org_id,application_id,starts_at);
CREATE INDEX offer_versions_tenant ON morrow.offer_versions(org_id,offer_id,version DESC);
