// Counts visits with Vercel Web Analytics: cookieless, no personal data, so no
// consent banner (see /privacy/). Loaded on every page, the game's included.
// It records nothing until Web Analytics is switched on for the project.

import { inject } from '@vercel/analytics';

inject();
