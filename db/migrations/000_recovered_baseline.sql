-- Agent Control Tower recovered schema baseline entrypoint.
-- Run with psql; \ir resolves includes relative to this file.
\ir 000_recovered_baseline/01_control_plane_tables.sql
\ir 000_recovered_baseline/02_simulated_system_tables.sql
\ir 000_recovered_baseline/03_constraints_indexes_rules.sql
\ir 000_recovered_baseline/04_guards_triggers_binding.sql
