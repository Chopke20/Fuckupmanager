import { describe, expect, it } from 'vitest';
import { shouldAskForTransportRecalculation } from './utils/transportPricing';

describe('transportPricing utils', () => {
  it('asks for confirmation only when distance changed and manual override exists', () => {
    expect(
      shouldAskForTransportRecalculation({ distanceChanged: true, hasManualOverride: true })
    ).toBe(true);
    expect(
      shouldAskForTransportRecalculation({ distanceChanged: true, hasManualOverride: false })
    ).toBe(false);
    expect(
      shouldAskForTransportRecalculation({ distanceChanged: false, hasManualOverride: true })
    ).toBe(false);
  });
});

