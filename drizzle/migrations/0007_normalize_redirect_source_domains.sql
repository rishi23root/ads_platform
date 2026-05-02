-- Migrate rows where source_domain starts with 'www.' to the root domain.
-- Intent: admin-configured rules with www. prefix were meant to match
-- all subdomains; strip the prefix and enable include_subdomains.
UPDATE redirects
SET
  source_domain = SUBSTRING(source_domain FROM 5),
  include_subdomains = true,
  updated_at = NOW()
WHERE source_domain LIKE 'www.%';
