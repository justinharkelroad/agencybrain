# Custom Domain Setup for Public Forms

## Overview
Public forms in Agency Brain can be accessed via custom domains using the pattern:
`agencyname.myagencybrain.com/f/form-slug?t=token`

## Setting Up Custom Domains

### 1. Domain Configuration in Lovable
1. Go to your Lovable project settings → **Domains**
2. Click **Connect Domain** and enter your domain (e.g., `myagencybrain.com`)
3. Follow the DNS setup instructions provided by Lovable

### 2. DNS Records Required
Add these DNS records at your domain registrar:

**A Records:**
- Type: A
- Name: @ (for root domain)
- Value: 185.158.133.1

- Type: A  
- Name: www
- Value: 185.158.133.1

**Subdomain Setup (for agency-specific URLs):**
- Type: CNAME
- Name: * (wildcard)
- Value: myagencybrain.com

This enables URLs like: `clientname.myagencybrain.com`

### 3. SSL Certificate
- Lovable automatically provisions SSL certificates
- Wait 24-48 hours for DNS propagation and SSL setup
- Verify HTTPS is working before sharing form links

### 4. Public Form URL Structure
Once configured, public forms will be accessible at:
```
https://agencyname.myagencybrain.com/f/form-slug?t=security-token
```

**URL Components:**
- `agencyname`: The client/agency subdomain
- `form-slug`: Unique identifier from the form template
- `security-token`: Access token for the specific form link

### 5. Testing Form Links
Use the development utility to test form links:
```javascript
import { testFormLink } from '@/utils/formLinkTester';

// Test a specific form link
testFormLink('sales-scorecard', '4c0bccb7-6988-4c20-bb4f-9e4a4a632fc6');
```

### 6. Troubleshooting
- **DNS Issues**: Use [DNSChecker.org](https://dnschecker.org) to verify DNS propagation
- **SSL Problems**: Ensure no conflicting CAA records exist
- **Form Not Loading**: Check console for JavaScript errors and verify token validity
- **404 Errors**: Confirm the form slug and token are correct in the database

### 7. Production Deployment
- Build the project: `npm run build`
- Test form links in production mode to ensure no development-only errors
- Verify error boundaries catch and handle any JavaScript crashes gracefully

## Security Notes
- Form tokens should be unique and non-guessable
- Consider implementing token expiration for enhanced security
- Monitor form submission logs for suspicious activity