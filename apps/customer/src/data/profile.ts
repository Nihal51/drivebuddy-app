/** users/{uid}: the customer's name and number, shared with the website's My account page. */

import { type Profile, profileFields } from '@drivebuddy/shared';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { firestore } from '@/firebase/app';

export async function loadProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(firestore(), 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { name: String(d.name ?? ''), phone: String(d.phone ?? ''), email: String(d.email ?? '') };
}

export async function saveProfile(uid: string, profile: Profile, isNew: boolean): Promise<Profile> {
  const ref = doc(firestore(), 'users', uid);
  const data = profileFields(profile);
  if (isNew) await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  else await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  return data;
}

/** Removes the saved name and number (account deletion). Bookings stay with the business records. */
export async function deleteProfile(uid: string): Promise<void> {
  await deleteDoc(doc(firestore(), 'users', uid));
}
