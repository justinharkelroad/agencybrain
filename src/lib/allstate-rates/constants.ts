// AAP Levels
export type AAPLevel = 'Elite' | 'Pro' | 'Emerging';
export type BundleType = 'Preferred' | 'Bundled' | 'Monoline';

// States with special rate structures
export const NO_VC_STATES = ['NY', 'NJ']; // No variable compensation at all
export const FLAT_RATE_STATES = ['CA', 'CT', 'FL']; // No bundling differentiation
export const DIFFERENT_HOME_STATES = ['TX', 'LA']; // Lower home/condo VC rates

// Base Commission Rates (Effective March 2025)
export const BASE_RATES = {
  newBusiness: 0.09, // 9% for all products
  renewal: {
    standardAuto: 0.04,      // 4%
    specialtyAuto6Month: 0.04,
    specialtyAuto12Month: 0.07,
    homeownersCondo: 0.07,   // 7%
    commercial: 0.07,
  }
};

// New Business VC Rates (when baseline achieved)
export const NB_VC_RATES = {
  countrywide: {
    StandardAuto: { Preferred: 0.16, Bundled: 0.11, Monoline: 0.06 },
    HomeownersCondo: { Preferred: 0.20, Bundled: 0.16, Monoline: 0.07 },
    OtherPersonal: { Preferred: 0.17, Bundled: 0.12, Monoline: 0.06 },
  },
  txla: {
    StandardAuto: { Preferred: 0.16, Bundled: 0.11, Monoline: 0.06 },
    HomeownersCondo: { Preferred: 0.17, Bundled: 0.13, Monoline: 0.04 },
    OtherPersonal: { Preferred: 0.17, Bundled: 0.12, Monoline: 0.06 },
  },
  flat: { // CA, CT, FL - flat 11% regardless of bundling
    StandardAuto: { Preferred: 0.11, Bundled: 0.11, Monoline: 0.11 },
    HomeownersCondo: { Preferred: 0.11, Bundled: 0.11, Monoline: 0.11 },
    OtherPersonal: { Preferred: 0.11, Bundled: 0.11, Monoline: 0.11 },
  }
};

// Renewal VC Rates by AAP Level
export const RENEWAL_VC_RATES = {
  countrywide: {
    Elite: {
      StandardAuto: { Preferred: 0.035, Bundled: 0.025 },
      HomeownersCondo: { Preferred: 0.035, Bundled: 0.025 },
      OtherPersonal: { Preferred: 0.030, Bundled: 0.020 },
    },
    Pro: {
      StandardAuto: { Preferred: 0.030, Bundled: 0.020 },
      HomeownersCondo: { Preferred: 0.030, Bundled: 0.020 },
      OtherPersonal: { Preferred: 0.030, Bundled: 0.020 },
    },
    Emerging: {
      StandardAuto: { Preferred: 0.030, Bundled: 0.020 },
      HomeownersCondo: { Preferred: 0.020, Bundled: 0.010 },
      OtherPersonal: { Preferred: 0.020, Bundled: 0.010 },
    },
  },
  flat: { // CA, CT, FL
    Elite: { StandardAuto: 0.05, HomeownersCondo: 0.02, OtherPersonal: 0.02 },
    Pro: { StandardAuto: 0.04, HomeownersCondo: 0.01, OtherPersonal: 0.01 },
    Emerging: { StandardAuto: 0.02, HomeownersCondo: 0.00, OtherPersonal: 0.00 },
  }
};
