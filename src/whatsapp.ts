import { Linking, Alert } from 'react-native';

export async function openWhatsApp(phone: string, message: string): Promise<void> {
  const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
  const encoded = encodeURIComponent(message).replace(/%20/g, '+');

  // Try native whatsapp:// scheme first, fall back to https://wa.me/
  const nativeUrl = `whatsapp://send?phone=${cleanPhone}&text=${encoded}`;
  const webUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

  try {
    const supported = await Linking.canOpenURL(nativeUrl);
    if (supported) {
      await Linking.openURL(nativeUrl);
      return;
    }
  } catch {
    // fall through
  }

  try {
    await Linking.openURL(webUrl);
  } catch {
    Alert.alert('Error', 'Could not open WhatsApp. Make sure WhatsApp is installed.');
  }
}
