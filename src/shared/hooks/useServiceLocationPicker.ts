import { useEffect, useRef, useState } from 'react';
import { servicePinValid, type ServicePin } from '@/shared/domain/serviceAddress';
import { useServiceLocationMap } from './useServiceLocationMap';

export function useServiceLocationPicker(initial: ServicePin | undefined) {
  const [latitude, setLatitude] = useState(initial ? String(initial.latitude) : '');
  const [longitude, setLongitude] = useState(initial ? String(initial.longitude) : '');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const requestVersion = useRef(0);
  useEffect(() => () => { requestVersion.current++; }, []);
  function selectPin(pin: ServicePin) {
    requestVersion.current++;
    setLocating(false);
    setLatitude(pin.latitude.toFixed(6));
    setLongitude(pin.longitude.toFixed(6));
  }
  const { container, controller, state, tileError } = useServiceLocationMap(initial, selectPin);
  const candidate = { latitude: Number(latitude), longitude: Number(longitude) };
  const pin = latitude.trim() && longitude.trim() && servicePinValid(candidate) ? candidate : null;
  function editCoordinate(key: 'latitude' | 'longitude', value: string) {
    requestVersion.current++;
    setLocating(false);
    (key === 'latitude' ? setLatitude : setLongitude)(value);
  }
  function locate() {
    if (!navigator.geolocation) { setLocationError('Location is unavailable on this device. Tap the map or enter coordinates.'); return; }
    const version = ++requestVersion.current;
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition((position) => {
      if (version !== requestVersion.current) return;
      const selected = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      selectPin(selected);
      controller.current?.setPin(selected, true);
    }, (error) => {
      if (version !== requestVersion.current) return;
      setLocationError(error.code === 1 ? 'Location permission was denied. Tap the map or enter coordinates instead.'
        : 'Your location could not be found. Tap the map or enter coordinates instead.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  return { latitude, longitude, locating, locationError, container, state, tileError, pin, editCoordinate, locate,
    zoom: (direction: number) => controller.current?.zoom(direction),
    selectCenter: () => controller.current?.selectCenter(),
    showCoordinates: () => { if (pin) controller.current?.setPin(pin, true); } };
}
