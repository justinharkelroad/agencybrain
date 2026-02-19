import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Users,
  Calendar,
  ChevronRight,
  Minus,
  Plus,
  CheckCircle2,
  Crown,
  ArrowLeft,
  Eye,
  BarChart3,
  UserPlus,
  ArrowRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { isChallengeTier } from '@/utils/tierAccess';

interface ChallengeProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_one_on_one_cents: number;
  price_boardroom_cents: number;
  price_standalone_cents: number;
  total_lessons: number;
  duration_weeks: number;
}

interface ChallengePurchase {
  id: string;
  quantity: number;
  seats_used: number;
  price_per_seat_cents: number;
  total_price_cents: number;
  status: string;
  purchased_at: string;
}

export default function ChallengePurchase() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [product, setProduct] = useState<ChallengeProduct | null>(null);
  const [purchases, setPurchases] = useState<ChallengePurchase[]>([]);
  const [membershipTier, setMembershipTier] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user's profile for membership tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, membership_tier')
        .eq('id', user!.id)
        .single();

      setMembershipTier(profile?.membership_tier || null);

      // Fetch the challenge product
      const { data: productData, error: productError } = await supabase
        .from('challenge_products')
        .select('*')
        .eq('is_active', true)
        .single();

      if (productError) {
        console.error('Error fetching product:', productError);
        toast.error('Failed to load challenge product');
        return;
      }

      setProduct(productData);

      // Fetch existing purchases for this agency
      if (profile?.agency_id) {
        const { data: purchasesData } = await supabase
          .from('challenge_purchases')
          .select('*')
          .eq('agency_id', profile.agency_id)
          .eq('status', 'completed')
          .order('purchased_at', { ascending: false });

        setPurchases(purchasesData || []);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getPricePerSeat = (): number => {
    if (!product) return 0;
    if (membershipTier === '1:1 Coaching') return product.price_one_on_one_cents;
    if (membershipTier === 'Boardroom') return product.price_boardroom_cents;
    return product.price_standalone_cents;
  };

  const getTierBadge = () => {
    if (membershipTier === '1:1 Coaching') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">1:1 Coaching Member</Badge>;
    }
    if (membershipTier === 'Boardroom') {
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Boardroom Member</Badge>;
    }
    return <Badge variant="outline">Standalone</Badge>;
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handlePurchase = async () => {
    if (!product) return;

    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('challenge-create-checkout', {
        body: {
          product_id: product.id,
          quantity,
        },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout');
    } finally {
      setPurchasing(false);
    }
  };

  const totalAvailableSeats = purchases.reduce((acc, p) => acc + (p.quantity - p.seats_used), 0);
  const totalAssignedSeats = purchases.reduce((acc, p) => acc + p.seats_used, 0);
  const isChallengeTierUser = isChallengeTier(membershipTier);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Challenge product not available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pricePerSeat = getPricePerSeat();
  const totalPrice = pricePerSeat * quantity;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Back Link - hidden for challenge tier since this is their home */}
      {!isChallengeTierUser && (
        <Link
          to="/training"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Training
        </Link>
      )}

      {/* Challenge Tier: Team Setup Prompt */}
      {isChallengeTierUser && totalAvailableSeats > 0 && totalAssignedSeats === 0 && (
        <Alert className="border-green-500/30 bg-green-500/10">
          <UserPlus className="h-4 w-4 text-green-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              You have <strong>{totalAvailableSeats} seat{totalAvailableSeats > 1 ? 's' : ''}</strong> ready to assign.
              Set up your team to get started!
            </span>
            <Button size="sm" asChild className="ml-4 shrink-0">
              <Link to="/training/challenge/assign">
                Set Up Team
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Challenge Tier: Progress Link */}
      {isChallengeTierUser && totalAssignedSeats > 0 && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>{totalAssignedSeats}</strong> team member{totalAssignedSeats > 1 ? 's' : ''} enrolled in the challenge.
            </span>
            <Button size="sm" variant="outline" asChild className="ml-4 shrink-0">
              <Link to="/training/challenge/progress">
                View Progress
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Hero Section */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1e283a 0%, #020817 100%)',
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Video */}
          <div className="relative aspect-video md:aspect-auto bg-black group">
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
              src="/promo-images/challenge-hero.mp4"
            />
            <button
              onClick={toggleMute}
              className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          {/* Content */}
          <div className="p-6 sm:p-8 flex flex-col justify-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-white">{product.name}</h1>
            <p className="text-muted-foreground mt-2">{product.description}</p>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-300">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {product.duration_weeks} weeks
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {product.total_lessons} lessons
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link to="/training/challenge/view">
                  <Eye className="h-4 w-4 mr-2" />
                  View Content
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/training/challenge/progress">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Staff Progress
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing & Purchase Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pricing Card */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Seats</CardTitle>
            <CardDescription>Assign staff members to The Challenge</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Membership Tier Display */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Your Membership</span>
              {getTierBadge()}
            </div>

            {/* Price Display */}
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Price per seat</p>
              <p className="text-4xl font-bold">{formatPrice(pricePerSeat)}</p>
              {membershipTier && membershipTier !== 'standalone' && (
                <p className="text-sm text-green-600 mt-1">
                  <Crown className="h-3 w-3 inline mr-1" />
                  Member discount applied
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="space-y-2">
              <Label>Number of seats</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                  min={1}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
            </div>

            {/* Purchase Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Purchase {quantity} seat{quantity > 1 ? 's' : ''}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Existing Purchases Card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Purchases</CardTitle>
            <CardDescription>
              {totalAvailableSeats > 0
                ? `${totalAvailableSeats} seat${totalAvailableSeats > 1 ? 's' : ''} available to assign`
                : 'No available seats'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {purchases.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No purchases yet. Buy seats above to get started.
                </p>
              </div>
            ) : (
              <>
                {purchases.map((purchase) => {
                  const available = purchase.quantity - purchase.seats_used;
                  return (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">
                          {purchase.quantity} seat{purchase.quantity > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Purchased {new Date(purchase.purchased_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {available} available
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {purchase.seats_used} assigned
                        </p>
                      </div>
                    </div>
                  );
                })}

                {totalAvailableSeats > 0 && (
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/training/challenge/assign">
                      <Users className="h-4 w-4 mr-2" />
                      Assign Staff Members
                    </Link>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* What's Included Section */}
      <Card>
        <CardHeader>
          <CardTitle>What's Included</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: '30 Daily Lessons',
                description: 'Video content with reflection questions and action items',
              },
              {
                title: 'Core 4 Tracking',
                description: 'Daily habit tracking for Body, Being, Balance, and Business',
              },
              {
                title: 'Discovery Flow',
                description: 'Weekly Friday guided reflections to cement learning',
              },
              {
                title: 'Email Reminders',
                description: 'Daily email prompts to keep staff on track',
              },
              {
                title: 'Progress Dashboard',
                description: 'Track completion and engagement metrics',
              },
              {
                title: '6-Week Structure',
                description: 'Foundational, Consistency, Discipline, Relationships, Closing, Identity',
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
