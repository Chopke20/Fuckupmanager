export function shouldAskForTransportRecalculation(params: {
  distanceChanged: boolean;
  hasManualOverride: boolean;
}) {
  return params.distanceChanged && params.hasManualOverride;
}

