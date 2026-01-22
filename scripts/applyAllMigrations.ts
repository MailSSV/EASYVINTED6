import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const migrationsDir = path.join(__dirname, '../supabase/migrations');

const migrations = [
  '20251118165156_create_articles_table.sql',
  '20251118165228_create_user_settings_table.sql',
  '20251118165241_create_user_profiles_table.sql',
  '20251118170708_add_season_and_suggested_period_to_articles.sql',
  '20251118173454_add_published_at_column.sql',
  '20251118185955_add_writing_style_to_user_profiles.sql',
  '20251118204522_add_persona_id_to_user_profiles.sql',
  '20251118210000_create_custom_personas_table.sql',
  '20251120184954_add_vinted_url_to_articles.sql',
  '20251122220347_create_family_members_table.sql',
  '20251122220411_add_seller_to_articles.sql',
  '20251122235414_add_writing_style_to_family_members.sql',
  '20251123151604_add_base_persona_id_to_custom_personas.sql',
  '20251123165521_add_size_fields_to_family_members.sql',
  '20251124235729_add_reference_number_to_articles.sql',
  '20251125180749_create_lots_table.sql',
  '20251125213523_add_reference_number_to_lots.sql',
  '20251125222045_add_sale_fields_to_lots.sql',
  '20251208232540_add_sold_at_to_lots.sql',
  '20251208234556_add_seller_id_to_lots.sql',
  '20251213215832_add_seo_fields_to_articles.sql',
  '20251217120000_add_seo_fields_to_lots.sql',
];

async function applyMigrations() {
  console.log('Starting migrations...\n');

  for (const migration of migrations) {
    const migrationPath = path.join(migrationsDir, migration);

    if (!fs.existsSync(migrationPath)) {
      console.log(`⚠️  Migration file not found: ${migration}`);
      continue;
    }

    console.log(`Applying: ${migration}`);

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

      if (error) {
        const { error: directError } = await supabase.from('_migrations').insert({ name: migration });

        if (directError) {
          console.error(`❌ Error applying ${migration}:`, error);
          continue;
        }
      }

      console.log(`✅ Successfully applied: ${migration}\n`);
    } catch (err: any) {
      console.error(`❌ Error applying ${migration}:`, err.message);
    }
  }

  console.log('\n✅ All migrations completed!');
}

applyMigrations().catch(console.error);
