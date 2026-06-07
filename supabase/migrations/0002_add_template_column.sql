-- Adds the template column used by the 4-template conversion pipeline
-- (document | resume | deck | interactive). Run this in the Supabase SQL editor.

alter table documents
  add column if not exists template text not null default 'document';

alter table documents
  add constraint documents_template_check
  check (template in ('document', 'resume', 'deck', 'interactive'));
