-- Self-assessed skills move from a 1–5 to a 1–100 scale (×20).
-- 0 means "not filled in yet" and stays 0.
UPDATE "PlayerSkill"
SET "value" = LEAST(100, ROUND("value" * 20))
WHERE "value" > 0;
