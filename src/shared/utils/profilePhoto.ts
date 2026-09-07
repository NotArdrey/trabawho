export const DEFAULT_PROFILE_PHOTO_URL = '/default-profile.svg';

const LEGACY_DEFAULT_PROFILE_PHOTOS = [
  'https://images.pexels.com/photos/18166927/pexels-photo-18166927.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/20687407/pexels-photo-20687407.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/18924728/pexels-photo-18924728.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/5363274/pexels-photo-5363274.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/2411795/pexels-photo-2411795.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/10501790/pexels-photo-10501790.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/8840560/pexels-photo-8840560.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/36130657/pexels-photo-36130657.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/6445627/pexels-photo-6445627.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
  'https://images.pexels.com/photos/13883040/pexels-photo-13883040.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=256&w=256',
];

type ProfilePhotoValue = string | null | undefined;

const normalizeUrl = (value: ProfilePhotoValue) => (value || '').trim();

export const isDefaultProfilePhoto = (value: ProfilePhotoValue) => {
  const url = normalizeUrl(value);
  if (!url) return true;
  return url === DEFAULT_PROFILE_PHOTO_URL || LEGACY_DEFAULT_PROFILE_PHOTOS.includes(url);
};

export const hasUploadedProfilePhoto = (value: ProfilePhotoValue) => !isDefaultProfilePhoto(value);

export const getProfilePhotoUrl = (value: ProfilePhotoValue) => (
  hasUploadedProfilePhoto(value) ? normalizeUrl(value) : DEFAULT_PROFILE_PHOTO_URL
);
