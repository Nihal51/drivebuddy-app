import { deviceDocId, isExpoPushToken, profileFields, validateProfile } from './account';
import { prettyPhone, telUrl, whatsappUrl } from './format';

test('profile: name required, phone optional but valid', () => {
  expect(validateProfile({ name: '', phone: '', email: '' })).toEqual({ name: 'required' });
  expect(validateProfile({ name: 'Ravi', phone: '12', email: '' })).toEqual({ phone: 'invalidMobile' });
  expect(profileFields({ name: ' Ravi  K ', phone: '+91 98765 43210', email: 'r@x.in' })).toEqual({
    name: 'Ravi K',
    phone: '9876543210',
    email: 'r@x.in',
  });
});

test('push tokens: only Expo tokens, stored under a safe id', () => {
  expect(isExpoPushToken('ExponentPushToken[abcdEFGH1234_-]')).toBe(true);
  expect(isExpoPushToken('ExpoPushToken[abcdEFGH1234]')).toBe(true);
  expect(isExpoPushToken('fcm:abc')).toBe(false);
  expect(isExpoPushToken('ExponentPushToken[short]')).toBe(false);
  expect(deviceDocId('ExponentPushToken[abc/def]')).toBe('ExponentPushToken_abc_def_');
});

test('phone links', () => {
  expect(prettyPhone('9111473929')).toBe('+91 91114 73929');
  expect(telUrl('9111473929')).toBe('tel:+919111473929');
  expect(whatsappUrl('9111473929', 'Hi there')).toBe('https://wa.me/919111473929?text=Hi%20there');
});
