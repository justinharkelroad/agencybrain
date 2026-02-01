import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LOGO_URL = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png";

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
];

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerVariants = {
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
  };

  return (
    <motion.header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-marketing-bg/80 backdrop-blur-xl border-b border-marketing-border shadow-lg'
          : 'bg-transparent'
      )}
      variants={prefersReducedMotion ? undefined : headerVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link to="/marketing" className="flex items-center gap-2 shrink-0">
            <img
              src={LOGO_URL}
              alt="AgencyBrain"
              className="h-10 sm:h-12 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-marketing-text-muted hover:text-marketing-text transition-colors text-sm font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Button
              variant="ghost"
              asChild
              className="text-marketing-text hover:text-marketing-amber hover:bg-marketing-surface"
            >
              <Link to="/auth">Login</Link>
            </Button>
            <Button
              asChild
              className="bg-marketing-amber hover:bg-marketing-amber-light text-white font-semibold rounded-full px-6"
            >
              <a href="#pricing">Start Free Trial</a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-marketing-text"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden pb-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <nav className="flex flex-col gap-4 pt-4 border-t border-marketing-border">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-marketing-text-muted hover:text-marketing-text transition-colors text-base font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4">
                <Button
                  variant="outline"
                  asChild
                  className="w-full border-marketing-border text-marketing-text"
                >
                  <Link to="/auth">Login</Link>
                </Button>
                <Button
                  asChild
                  className="w-full bg-marketing-amber hover:bg-marketing-amber-light text-white font-semibold"
                >
                  <a href="#pricing">Start Free Trial</a>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}
