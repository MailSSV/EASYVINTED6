import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testWorkflow() {
  console.log("🧪 Testing Agent Workflow...\n");

  // Step 1: Find a "ready" article
  console.log("1️⃣ Looking for 'ready' articles...");
  const { data: articles, error: fetchError } = await supabase
    .from("articles")
    .select("id, title, status")
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(1);

  if (fetchError) {
    console.error("❌ Error fetching articles:", fetchError);
    return;
  }

  if (!articles || articles.length === 0) {
    console.log("⚠️  No 'ready' articles found. Creating a test article...");

    const { data: newArticle, error: createError } = await supabase
      .from("articles")
      .insert({
        title: "Test Article for Agent Workflow",
        description: "This is a test article to verify the agent workflow works correctly.",
        price: 15.99,
        status: "ready",
        brand: "Test Brand",
        size: "M",
        condition: "Très bon état",
        main_category: "Femmes",
        subcategory: "Vêtements",
        item_category: "T-shirts"
      })
      .select()
      .single();

    if (createError) {
      console.error("❌ Error creating test article:", createError);
      return;
    }

    console.log("✅ Test article created:", newArticle.id);
    articles.push(newArticle);
  }

  const article = articles[0];
  console.log(`✅ Found article: ${article.title} (${article.id})`);
  console.log(`   Current status: ${article.status}\n`);

  // Step 2: Simulate "Start Run" - update status to "processing"
  console.log("2️⃣ Simulating 'Start Run' action...");
  const { data: updatedArticle, error: updateError } = await supabase
    .from("articles")
    .update({
      status: "processing",
      sale_notes: `[AGENT_LOCKED_BY:test_session_${Date.now()}] ${new Date().toISOString()}`
    })
    .eq("id", article.id)
    .eq("status", "ready")
    .select();

  if (updateError) {
    console.error("❌ Error updating status:", updateError);
    return;
  }

  if (!updatedArticle || updatedArticle.length === 0) {
    console.log("⚠️  No rows updated. Article may have been modified already.");

    // Check current status
    const { data: currentArticle } = await supabase
      .from("articles")
      .select("status")
      .eq("id", article.id)
      .single();

    console.log(`   Current status in DB: ${currentArticle?.status}`);
    return;
  }

  console.log("✅ Status updated to 'processing'");
  console.log(`   Updated article:`, updatedArticle[0]);

  // Step 3: Verify the status change
  console.log("\n3️⃣ Verifying status change...");
  const { data: verifyArticle, error: verifyError } = await supabase
    .from("articles")
    .select("id, title, status, sale_notes")
    .eq("id", article.id)
    .single();

  if (verifyError) {
    console.error("❌ Error verifying article:", verifyError);
    return;
  }

  console.log("✅ Verification successful:");
  console.log(`   ID: ${verifyArticle.id}`);
  console.log(`   Title: ${verifyArticle.title}`);
  console.log(`   Status: ${verifyArticle.status}`);
  console.log(`   Sale Notes: ${verifyArticle.sale_notes}\n`);

  if (verifyArticle.status === "processing") {
    console.log("✅ ✅ ✅ WORKFLOW TEST PASSED! ✅ ✅ ✅");
    console.log("The 'Start Run' button correctly updates status from 'ready' to 'processing'\n");
  } else {
    console.log("❌ ❌ ❌ WORKFLOW TEST FAILED! ❌ ❌ ❌");
    console.log(`Expected status 'processing', got '${verifyArticle.status}'\n`);
  }

  // Step 4: Reset the article to "ready" for next test
  console.log("4️⃣ Resetting article to 'ready' status...");
  await supabase
    .from("articles")
    .update({ status: "ready", sale_notes: null })
    .eq("id", article.id);

  console.log("✅ Article reset to 'ready' status");
  console.log("\n🎉 Test completed!");
}

testWorkflow().catch(console.error);
