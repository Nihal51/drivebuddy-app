import { telUrl, whatsappUrl } from '@drivebuddy/shared';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/** Opens a link in the right app; a phone with no dialler or WhatsApp just does nothing. */
export async function openUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export const callNumber = (phone10: string) => openUrl(telUrl(phone10));

export const openWhatsapp = (phone10: string, text?: string) => openUrl(whatsappUrl(phone10, text));

export const sendEmail = (to: string, subject?: string) =>
  openUrl(`mailto:${to}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`);

/** Website pages (privacy, terms) open in an in-app browser so the customer stays in the app. */
export async function openWebPage(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    await openUrl(url);
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await openUrl(url);
  }
}
