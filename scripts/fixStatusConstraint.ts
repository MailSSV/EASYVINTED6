import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStatusConstraint() {
  console.log("🔧 Fixing status constraint to include 'processing' and 'error'...\n");

  // Fix articles table
  console.log("1️⃣ Updating articles table constraint...");
  const articlesQuery = `
    DO $$
    BEGIN
      -- Drop existing constraint
      ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;

      -- Add updated constraint with all status values
      ALTER TABLE articles ADD CONSTRAINT articles_status_check
        CHECK (status IN (
          'draft',
          'ready',
          'scheduled',
          'published',
          'vinted_draft',
          'sold',
          'vendu_en_lot',
          'reserved',
          'processing',
          'error'
        ));
    END $$;
  `;

  const { error: articlesError } = await supabase.rpc('exec_sql', { sql: articlesQuery }).single();

  if (articlesError) {
    // Try direct execution
    const { error: directError } = await supabase.from('articles').select('id').limit(0);

    console.log("Trying alternative approach...");
    const altQuery = `
      ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
      ALTER TABLE articles ADD CONSTRAINT articles_status_check
        CHECK (status IN (
          'draft',
          'ready',
          'scheduled',
          'published',
          'vinted_draft',
          'sold',
          'vendu_en_lot',
          'reserved',
          'processing',
          'error'
        ));
    `;

    console.log("\n⚠️  Note: This script requires direct database access.");
    console.log("Please run the following SQL in your Supabase SQL Editor:\n");
    console.log("--- SQL START ---");
    console.log(altQuery);
    console.log("--- SQL END ---\n");

    console.log("Or for lots table:");
    console.log("--- SQL START ---");
    console.log(`
      ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_status_check;
      ALTER TABLE lots ADD CONSTRAINT lots_status_check
        CHECK (status IN (
          'draft',
          'ready',
          'scheduled',
          'published',
          'vinted_draft',
          'sold',
          'processing',
          'error'
        ));
    `);
    console.log("--- SQL END ---\n");

    return;
  }

  console.log("✅ Articles table constraint updated\n");

  // Fix lots table
  console.log("2️⃣ Updating lots table constraint...");
  const lotsQuery = `
    DO $$
    BEGIN
      -- Drop existing constraint
      ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_status_check;

      -- Add updated constraint with all status values
      ALTER TABLE lots ADD CONSTRAINT lots_status_check
        CHECK (status IN (
          'draft',
          'ready',
          'scheduled',
          'published',
          'vinted_draft',
          'sold',
          'processing',
          'error'
        ));
    END $$;
  `;

  const { error: lotsError } = await supabase.rpc('exec_sql', { sql: lotsQuery }).single();

  if (lotsError) {
    console.log("⚠️  Could not update lots table constraint automatically");
  } else {
    console.log("✅ Lots table constraint updated");
  }

  console.log("\n🎉 Migration completed!");
}

fixStatusConstraint().catch(console.error);
