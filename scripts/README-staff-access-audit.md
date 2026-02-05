# Staff Access Audit System

Automated detection and fixing of staff access issues in edge functions and RLS policies.

## What It Does

### Daily at 5am ET:
1. **Audits** all edge functions and migrations for common staff access issues
2. **Auto-fixes** issues that have safe, templated solutions
3. **Creates a PR** with the fixes
4. **Notifies** via Slack (or email) with a summary

### On Every PR:
- Checks for new staff access issues in modified files
- **Blocks PRs** with high-severity issues

## Issues Detected

| Issue | Severity | Auto-Fixable |
|-------|----------|--------------|
| `staff_users!inner()` joins | High | Yes |
| `"Unknown"` fallback for user names | Medium | Yes |
| `session.staff_users` direct access | High | Yes |
| Missing `has_agency_access()` in RLS | High | No (needs migration) |
| JWT claims parsing for staff | High | No (needs migration) |

## Setup

### 1. Slack Webhook (Recommended)

1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app or use existing
3. Add "Incoming Webhooks" feature
4. Create a webhook for your channel (e.g., `#dev-alerts`)
5. Copy the webhook URL

Add to GitHub Secrets:
```
Repository Settings → Secrets and variables → Actions → New repository secret
Name: SLACK_WEBHOOK_URL
Value: https://hooks.slack.com/services/XXX/YYY/ZZZ
```

### 2. GitHub Token

The default `GITHUB_TOKEN` is used for creating PRs. No additional setup needed.

If you want PRs to trigger other workflows, create a PAT:
1. Settings → Developer settings → Personal access tokens
2. Create token with `repo` scope
3. Add as secret `PAT_TOKEN`
4. Update workflow to use `${{ secrets.PAT_TOKEN }}`

## Manual Usage

### Run Audit Locally
```bash
# Full audit with markdown report
npx ts-node scripts/staff-access-audit.ts

# JSON output
npx ts-node scripts/staff-access-audit.ts --json

# Slack-formatted output
npx ts-node scripts/staff-access-audit.ts --slack

# Only check changed files
npx ts-node scripts/staff-access-audit.ts --changed-only
```

### Run Auto-Fix Locally
```bash
# Dry run (see what would change)
npx ts-node scripts/staff-access-fix.ts --dry-run

# Actually fix issues
npx ts-node scripts/staff-access-fix.ts
```

### Trigger Workflow Manually
1. Go to Actions tab
2. Select "Staff Access Audit"
3. Click "Run workflow"
4. Choose options (auto-fix, notify)

## Adding New Patterns

Edit `scripts/staff-access-audit.ts`:

```typescript
const PROBLEMATIC_PATTERNS = {
  // Add your pattern here
  myNewPattern: {
    pattern: /your-regex-here/g,
    type: 'rls_policy' as const,
    severity: 'high' as const,
    description: 'Description of the issue',
    autoFixable: false,
  },
};
```

For auto-fixable patterns, also add a fix function in `scripts/staff-access-fix.ts`.

## Troubleshooting

### Workflow not running at 5am ET?
- Check the cron schedule: `0 10 * * *` = 10:00 UTC = 5:00 AM ET
- During daylight saving time, this may be 6:00 AM ET
- GitHub Actions schedules can be delayed up to 15 minutes

### No Slack notifications?
- Verify `SLACK_WEBHOOK_URL` secret is set
- Check webhook is active in Slack app settings
- Look at workflow logs for curl errors

### Auto-fix not creating PR?
- Check if there are actually auto-fixable issues
- Verify the bot has write access to the repo
- Look for errors in the "Create Pull Request" step

### False positives?
- Add file to `SKIP_PATTERNS` in `staff-access-audit.ts`
- Or adjust the regex pattern to be more specific
