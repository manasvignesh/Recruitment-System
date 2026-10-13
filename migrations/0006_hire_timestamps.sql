ALTER TABLE morrow.applications ADD COLUMN hired_at timestamptz;
UPDATE morrow.applications a SET hired_at=(SELECT max(h.created_at) FROM morrow.application_stage_history h WHERE h.application_id=a.id AND h.to_stage='Hired') WHERE a.status='hired';
