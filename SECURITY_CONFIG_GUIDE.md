# Security Configuration Guide

This document provides instructions for additional security configurations that cannot be automated through migrations.

## Leaked Password Protection (HaveIBeenPwned Integration)

Supabase Auth can automatically check user passwords against the HaveIBeenPwned database to prevent the use of compromised passwords.

### How to Enable

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Click on **Email** provider
5. Scroll down to find the **Leaked Password Protection** section
6. Enable the toggle for **"Check passwords against HaveIBeenPwned.org"**
7. Click **Save**

### What This Does

When enabled, Supabase will:
- Check all new passwords during signup against the HaveIBeenPwned database
- Check passwords during password reset/change operations
- Reject passwords that have been compromised in known data breaches
- Provide clear error messages to users when a compromised password is detected

### User Experience

Users attempting to use a compromised password will receive an error message:
```
Password has been found in a data breach. Please use a different password.
```

### Benefits

- Prevents users from using passwords that have been exposed in data breaches
- Reduces the risk of account takeover attacks
- Improves overall application security
- No performance impact (checks are performed asynchronously)

### Compliance

This feature helps meet security best practices and compliance requirements such as:
- OWASP Authentication Guidelines
- NIST Digital Identity Guidelines
- PCI DSS Requirements
- General cybersecurity hygiene

## Recently Fixed Security Issues

The following security issues have been automatically fixed via database migration:

### 1. Missing Indexes on Foreign Keys
- ✅ Added index on `lots.seller_id`
- ✅ Added index on `user_profiles.default_seller_id`
- **Benefit**: Prevents slow queries and table scans on foreign key lookups

### 2. Unused Index Removal
- ✅ Removed unused index `idx_user_profiles_custom_persona_id`
- **Benefit**: Reduces storage overhead and improves write performance

### 3. Function Search Path Security
- ✅ Fixed `reset_articles_before_lot_deletion()` with SECURITY DEFINER and explicit search_path
- ✅ Fixed `update_articles_on_lot_status_change()` with SECURITY DEFINER and explicit search_path
- ✅ Fixed `validate_article_sold_status()` with SECURITY DEFINER and explicit search_path
- **Benefit**: Prevents search_path injection attacks and ensures functions run with proper privileges

## Verification

To verify all security fixes have been applied, run:

```sql
-- Check indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_lots_seller_id', 'idx_user_profiles_default_seller_id');

-- Check function security settings
SELECT
  proname AS function_name,
  CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  proconfig AS config
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname LIKE '%article%';
```

## Maintenance

Review security settings periodically:
- Check for new unused indexes quarterly
- Audit function security settings after major updates
- Keep the leaked password protection feature enabled at all times
