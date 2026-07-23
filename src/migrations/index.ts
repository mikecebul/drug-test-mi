import * as migration_20251005_184859_migration from './20251005_184859_migration'
import * as migration_20251017_145316_migration from './20251017_145316_migration'
import * as migration_20251211_191941_migration from './20251211_191941_migration'
import * as migration_20251228_063653_migration from './20251228_063653_migration'
import * as migration_20260208_120000_migration from './20260208_120000_migration'
import * as migration_20260219_021650_migration from './20260219_021650_migration'
import * as migration_20260222_042245_migration from './20260222_042245_migration'
import * as migration_20260512_000000_add_17_panel_instant_test_type from './20260512_000000_add_17_panel_instant_test_type'
import * as migration_20260523_000000_add_test_type_prices from './20260523_000000_add_test_type_prices'
import * as migration_20260524_000000_add_toxaccess_test_codes from './20260524_000000_add_toxaccess_test_codes'
import * as migration_20260525_000000_deactivate_15_panel_instant_test_type from './20260525_000000_deactivate_15_panel_instant_test_type'
import * as migration_20260526_000000_migrate_referrals_to_17_panel_instant from './20260526_000000_migrate_referrals_to_17_panel_instant'
import * as migration_20260701_000000_migrate_test_type_relationships_to_config_values from './20260701_000000_migrate_test_type_relationships_to_config_values'
import * as migration_20260709_000000_add_17_panel_sos_toxaccess_code from './20260709_000000_add_17_panel_sos_toxaccess_code'
import * as migration_20260711_000000_deduplicate_job_runs from './20260711_000000_deduplicate_job_runs'
import * as migration_20260712_000000_migrate_client_default_test_to_config_value from './20260712_000000_migrate_client_default_test_to_config_value'
import * as migration_20260718_000000_backfill_client_search_fields from './20260718_000000_backfill_client_search_fields'
import * as migration_20260719_000000_normalize_client_gender from './20260719_000000_normalize_client_gender'
import * as migration_20260723_203006_increase_client_dobs_one_day from './20260723_203006_increase_client_dobs_one_day'

export const migrations = [
  {
    up: migration_20251005_184859_migration.up,
    down: migration_20251005_184859_migration.down,
    name: '20251005_184859_migration',
  },
  {
    up: migration_20251017_145316_migration.up,
    down: migration_20251017_145316_migration.down,
    name: '20251017_145316_migration',
  },
  {
    up: migration_20251211_191941_migration.up,
    down: migration_20251211_191941_migration.down,
    name: '20251211_191941_migration',
  },
  {
    up: migration_20251228_063653_migration.up,
    down: migration_20251228_063653_migration.down,
    name: '20251228_063653_migration',
  },
  {
    up: migration_20260208_120000_migration.up,
    down: migration_20260208_120000_migration.down,
    name: '20260208_120000_migration',
  },
  {
    up: migration_20260219_021650_migration.up,
    down: migration_20260219_021650_migration.down,
    name: '20260219_021650_migration',
  },
  {
    up: migration_20260222_042245_migration.up,
    down: migration_20260222_042245_migration.down,
    name: '20260222_042245_migration',
  },
  {
    up: migration_20260512_000000_add_17_panel_instant_test_type.up,
    down: migration_20260512_000000_add_17_panel_instant_test_type.down,
    name: '20260512_000000_add_17_panel_instant_test_type',
  },
  {
    up: migration_20260523_000000_add_test_type_prices.up,
    down: migration_20260523_000000_add_test_type_prices.down,
    name: '20260523_000000_add_test_type_prices',
  },
  {
    up: migration_20260524_000000_add_toxaccess_test_codes.up,
    down: migration_20260524_000000_add_toxaccess_test_codes.down,
    name: '20260524_000000_add_toxaccess_test_codes',
  },
  {
    up: migration_20260525_000000_deactivate_15_panel_instant_test_type.up,
    down: migration_20260525_000000_deactivate_15_panel_instant_test_type.down,
    name: '20260525_000000_deactivate_15_panel_instant_test_type',
  },
  {
    up: migration_20260526_000000_migrate_referrals_to_17_panel_instant.up,
    down: migration_20260526_000000_migrate_referrals_to_17_panel_instant.down,
    name: '20260526_000000_migrate_referrals_to_17_panel_instant',
  },
  {
    up: migration_20260701_000000_migrate_test_type_relationships_to_config_values.up,
    down: migration_20260701_000000_migrate_test_type_relationships_to_config_values.down,
    name: '20260701_000000_migrate_test_type_relationships_to_config_values',
  },
  {
    up: migration_20260709_000000_add_17_panel_sos_toxaccess_code.up,
    down: migration_20260709_000000_add_17_panel_sos_toxaccess_code.down,
    name: '20260709_000000_add_17_panel_sos_toxaccess_code',
  },
  {
    up: migration_20260711_000000_deduplicate_job_runs.up,
    down: migration_20260711_000000_deduplicate_job_runs.down,
    name: '20260711_000000_deduplicate_job_runs',
  },
  {
    up: migration_20260712_000000_migrate_client_default_test_to_config_value.up,
    down: migration_20260712_000000_migrate_client_default_test_to_config_value.down,
    name: '20260712_000000_migrate_client_default_test_to_config_value',
  },
  {
    up: migration_20260718_000000_backfill_client_search_fields.up,
    down: migration_20260718_000000_backfill_client_search_fields.down,
    name: '20260718_000000_backfill_client_search_fields',
  },
  {
    up: migration_20260719_000000_normalize_client_gender.up,
    down: migration_20260719_000000_normalize_client_gender.down,
    name: '20260719_000000_normalize_client_gender',
  },
  {
    up: migration_20260723_203006_increase_client_dobs_one_day.up,
    down: migration_20260723_203006_increase_client_dobs_one_day.down,
    name: '20260723_203006_increase_client_dobs_one_day',
  },
]
