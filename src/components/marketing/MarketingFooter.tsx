import { Link } from 'react-router-dom';
import lightModeLogo from "@/assets/agencybrain-landing-logo.png";

// White text logo for dark backgrounds
const DARK_MODE_LOGO = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png";

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'How It Works', href: '#how-it-works' },
  ],
  company: [
    { label: 'About', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Blog', href: '#' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
};

export function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-marketing-surface border-t border-marketing-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="md:col-span-1">
            <Link to="/marketing" className="inline-block mb-4">
              {/* Light mode: dark text logo */}
              <img
                src={lightModeLogo}
                alt="AgencyBrain"
                className="h-12 w-auto dark:hidden"
              />
              {/* Dark mode: white text logo */}
              <img
                src={DARK_MODE_LOGO}
                alt="AgencyBrain"
                className="h-12 w-auto hidden dark:block"
              />
            </Link>
            <p className="text-marketing-text-muted text-sm leading-relaxed">
              AI-powered tools that help insurance agencies run like machines.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-marketing-text font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-marketing-text-muted hover:text-marketing-text transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-marketing-text font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-marketing-text-muted hover:text-marketing-text transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-marketing-text font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-marketing-text-muted hover:text-marketing-text transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-marketing-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-marketing-text-muted text-sm">
            &copy; {currentYear} AgencyBrain. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/auth"
              className="text-marketing-text-muted hover:text-marketing-text transition-colors text-sm"
            >
              Brain Portal Login
            </Link>
            <Link
              to="/staff/login"
              className="text-marketing-text-muted hover:text-marketing-text transition-colors text-sm"
            >
              Staff Portal Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
