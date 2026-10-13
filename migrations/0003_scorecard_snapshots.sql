ALTER TABLE morrow.interviews ADD COLUMN scorecard_criteria jsonb NOT NULL DEFAULT '["Role expertise","Problem solving","Communication","Collaboration"]';
