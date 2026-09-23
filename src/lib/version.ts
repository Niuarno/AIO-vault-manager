export interface AppVersionInfo {
  version: string;
  buildNumber: number;
  releaseDate: string;
  minSupportedVersion: string;
  releaseNotes: string[];
  isMandatory: boolean;
}

export const CURRENT_APP_VERSION: AppVersionInfo = {
  version: '1.1.0',
  buildNumber: 101,
  releaseDate: '2026-09-23',
  minSupportedVersion: '1.0.0',
  releaseNotes: [
    'Native Mobile UI/UX Redesign with thumb-friendly controls',
    'Fixed Bottom Navigation Bar with tactile haptic feedback',
    'Over-The-Air (OTA) Live In-App Update Engine',
    'Steadfast 1-Click Mobile Dispatch & Courier Balance',
    'High-Priority Push Notifications for incoming orders'
  ],
  isMandatory: false,
};
