UPDATE public.chatbot_knowledge_base
SET content = content || '

---

# DATA SECURITY & PRIVACY

## Is Customer Data Safe?

**Yes, Agency Brain takes data security seriously.**

**Security Measures**:
- **Encryption**: All data is encrypted in transit (HTTPS/TLS) and at rest
- **Authentication**: Secure login with password hashing, session management
- **Row-Level Security (RLS)**: Database policies ensure users only see their own agency''s data
- **Isolated Data**: Each agency''s data is completely separate - other agencies cannot see your customers
- **Supabase Infrastructure**: Built on enterprise-grade cloud infrastructure with SOC 2 compliance
- **No Data Sharing**: Your customer data is never shared with other agencies or third parties

**Who Can See Your Data**:
- **You** (agency owner): Full access to your agency''s data
- **Your Key Employees**: Same access as you (if you''ve added them)
- **Your Staff** (via Staff Portal): Only their own submissions and assigned data
- **Other Agencies**: CANNOT see any of your data - complete isolation
- **Agency Brain Admin**: Limited access for support purposes only

**Your Customer''s Policy Numbers, Names, etc.**:
- Stored securely in YOUR agency''s isolated database partition
- Protected by row-level security policies
- Only accessible by you and your authorized team members
- NOT visible to other Agency Brain users or agencies

**Common Questions**:
- "Can other agencies see my data?" → No, absolutely not. Each agency''s data is completely isolated.
- "Is my customer data encrypted?" → Yes, all data is encrypted both in transit and at rest.
- "Who at Agency Brain can see my data?" → Only authorized support staff, and only when needed to help you.
- "Can someone hack into my account?" → We use industry-standard security. Always use a strong password and don''t share your login.

**For detailed security questions**: Email info@standardplaybook.com
',
version = version + 1,
updated_at = NOW()
WHERE is_active = true;