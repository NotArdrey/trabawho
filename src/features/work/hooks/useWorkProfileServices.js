import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../shared/services/supabaseClient';
import {
  createEmptyAvailabilityTemplate,
  createServiceSlotsFromAvailability,
  getAvailabilitySlotCount,
  normalizeAvailabilityTemplate,
} from '../services/scheduleService';
import {
  createWorkerService,
  getAuthenticatedWorkUser,
  loadWorkerProfileServices,
  mapSellerRowToUiProfile,
  mapServiceRowToWorkerService,
  subscribeToWorkProfileChanges,
  updateWorkerProfile,
  withWorkerPreferences,
} from '../services/workerService';

const createDefaultNewService = () => ({
  title: '',
  shortDescription: '',
  description: '',
  basePrice: '',
  priceType: 'fixed',
  rateBasis: 'per-project',
  bookingMode: 'with-slots',
  currency: 'PHP',
  durationMinutes: '',
  availability: createEmptyAvailabilityTemplate(),
});

const buildDefaultServiceForSeller = ({ sellerData, workerProfileBundle, sellerProfile }) => {
  const serviceType =
    workerProfileBundle?.serviceType ||
    workerProfileBundle?.customServiceType ||
    sellerProfile?.serviceType ||
    sellerData?.headline ||
    sellerData?.search_meta?.service_type ||
    'Service';
  const description =
    workerProfileBundle?.bio ||
    sellerProfile?.bio ||
    sellerData?.about ||
    sellerData?.tagline ||
    `Professional ${serviceType} service.`;
  const rateBasis = workerProfileBundle?.rateBasis || sellerProfile?.rateBasis || 'per-project';
  const basePrice =
    workerProfileBundle?.fixedPrice ||
    workerProfileBundle?.hourlyRate ||
    workerProfileBundle?.dailyRate ||
    workerProfileBundle?.weeklyRate ||
    workerProfileBundle?.monthlyRate ||
    workerProfileBundle?.projectRate ||
    sellerProfile?.fixedPrice ||
    null;

  return {
    title: serviceType,
    shortDescription: description.slice(0, 160),
    description,
    basePrice,
    priceType: workerProfileBundle?.pricingModel === 'inquiry' ? 'custom' : 'fixed',
    currency: 'PHP',
    durationMinutes: null,
    metadata: {
      createdVia: 'my-work-auto-repair',
      rate_basis: rateBasis,
      booking_mode: workerProfileBundle?.bookingMode || sellerProfile?.bookingMode || sellerData?.search_meta?.booking_mode || 'with-slots',
    },
  };
};

export const useWorkProfileServices = ({ sellerProfile } = {}) => {
  const [authUser, setAuthUser] = useState(null);
  const [workerServices, setWorkerServices] = useState([]);
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const [sellerData, setSellerData] = useState(null);
  const [workerProfileBundle, setWorkerProfileBundle] = useState(null);
  const [sellerRatingAggregate, setSellerRatingAggregate] = useState(null);
  const [sellerDbServices, setSellerDbServices] = useState([]);
  const [isLoadingSellerData, setIsLoadingSellerData] = useState(true);
  const [sellerDataError, setSellerDataError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [newService, setNewService] = useState(() => createDefaultNewService());
  const sellerDataRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    getAuthenticatedWorkUser()
      .then((user) => {
        if (isMounted) setAuthUser(user);
      })
      .catch((error) => {
        console.error('Unable to resolve authenticated work user:', error);
        if (isMounted) setAuthUser(null);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const refreshWorkData = useCallback(async () => {
    if (!authUser?.id) {
      setIsLoadingSellerData(false);
      return;
    }

    try {
      setIsLoadingSellerData(true);
      setSellerDataError(null);

      const result = await loadWorkerProfileServices({
        userId: authUser.id,
        fallbackProfile: sellerProfile,
      });

      let resolvedServices = result.sellerDbServices || [];
      let resolvedWorkerServices = result.workerServices || [];

      if (result.sellerData && resolvedServices.length === 0) {
        const repaired = await createWorkerService({
          sellerId: result.sellerData.user_id || authUser.id,
          serviceData: buildDefaultServiceForSeller({
            sellerData: result.sellerData,
            workerProfileBundle: result.workerProfileBundle,
            sellerProfile,
          }),
          sellerData: result.sellerData,
          fallbackProfile: sellerProfile,
        });
        resolvedServices = [repaired.raw];
        resolvedWorkerServices = [repaired.mapped];
      }

      setSellerData(result.sellerData);
      sellerDataRef.current = result.sellerData;
      setWorkerProfileBundle(result.workerProfileBundle);
      setSellerRatingAggregate(result.sellerRatingAggregate || null);
      setSellerDbServices(resolvedServices);
      setWorkerServices(resolvedWorkerServices);
      setActiveServiceIndex((index) => Math.min(index, Math.max(0, resolvedWorkerServices.length - 1)));
    } catch (error) {
      console.error('Failed to load seller data:', error);
      setSellerDataError(error?.message || 'Failed to load seller profile');
    } finally {
      setIsLoadingSellerData(false);
    }
  }, [authUser?.id, sellerProfile]);

  useEffect(() => {
    refreshWorkData();
  }, [refreshWorkData]);

  const sellerId = sellerData?.user_id || sellerData?.id || authUser?.id || null;

  useEffect(() => {
    if (!sellerId) return undefined;

    return subscribeToWorkProfileChanges({
      sellerId,
      onSellerChange: (payload) => {
        const row = payload.new || payload.record || null;
        if (!row) return;
        setSellerData(row);
        sellerDataRef.current = row;
      },
      onServiceChange: (payload) => {
        const eventType = payload.eventType || payload.event || payload.type || '';
        const row = payload.new || payload.record || null;
        const oldRow = payload.old || null;

        if ((eventType === 'INSERT' || eventType === 'UPDATE') && row?.active) {
          setSellerDbServices((prev) => {
            const others = (prev || []).filter((service) => service.id !== row.id);
            return [row, ...others];
          });
          setWorkerServices((prev) => {
            const sellerSnapshot = sellerDataRef.current || {};
            const mapped = mapServiceRowToWorkerService(row, sellerSnapshot, sellerProfile);
            const others = (prev || []).filter((service) => service.raw?.id !== row.id);
            return [mapped, ...others];
          });
        }

        if (eventType === 'DELETE' || (eventType === 'UPDATE' && row?.active === false)) {
          const idToRemove = oldRow?.id || row?.id || payload.record?.id;
          setSellerDbServices((prev) => (prev || []).filter((service) => service.id !== idToRemove));
          setWorkerServices((prev) => (prev || []).filter((service) => service.raw?.id !== idToRemove));
        }
      },
    });
  }, [sellerId, sellerProfile]);

  const sellerUiProfile = useMemo(
    () => mapSellerRowToUiProfile(sellerData, workerProfileBundle, sellerProfile),
    [sellerData, workerProfileBundle, sellerProfile]
  );

  const currentProfile = workerServices[activeServiceIndex] || sellerUiProfile || sellerProfile || {
    fullName: sellerProfile?.fullName || 'Service Provider',
    serviceType: sellerProfile?.serviceType || 'Service',
    location: sellerProfile?.location || { barangay: '', city: '', province: '' },
    bookingMode: sellerProfile?.bookingMode || 'with-slots',
  };

  const hasSellerRecord = Boolean(
    sellerData?.user_id ||
    sellerData?.display_name ||
    sellerProfile?.isWorker ||
    sellerProfile?.role === 'worker' ||
    sellerProfile?.role === 'admin'
  );
  const hasService = (workerServices || []).length > 0;
  const showSetupBanner = !isLoadingSellerData && !hasSellerRecord;

  const closeCreateService = useCallback(() => setIsCreateServiceOpen(false), []);

  const handleCreateServiceChange = useCallback((field, value) => {
    setNewService((previous) => ({ ...previous, [field]: value }));
  }, []);

  const handleCreateServiceSubmit = useCallback(async () => {
    if (!sellerId) {
      setSellerDataError('Seller record missing. Complete onboarding first.');
      return;
    }

    try {
      setSellerDataError(null);
      const bookingMode = newService.bookingMode === 'calendar-only' ? 'calendar-only' : 'with-slots';
      const availabilityTemplate = normalizeAvailabilityTemplate(newService.availability);
      const availabilitySlotCount = getAvailabilitySlotCount(availabilityTemplate);

      if (bookingMode === 'with-slots' && availabilitySlotCount === 0) {
        setSellerDataError('Add at least one availability slot before publishing a time-slot service.');
        return null;
      }

      const payload = {
        title: newService.title,
        shortDescription: newService.shortDescription,
        description: newService.description || newService.shortDescription,
        basePrice: Number(newService.basePrice) || null,
        priceType: newService.priceType,
        currency: newService.currency || 'PHP',
        durationMinutes: newService.durationMinutes ? Number(newService.durationMinutes) : null,
        metadata: {
          createdVia: 'ui',
          rate_basis: newService.rateBasis || 'per-project',
          booking_mode: bookingMode,
          ...(bookingMode === 'with-slots'
            ? {
                availability_template: availabilityTemplate,
                availability_horizon_weeks: 7,
              }
            : {}),
        },
      };

      const created = await createWorkerService({
        sellerId,
        serviceData: payload,
        sellerData,
        fallbackProfile: sellerProfile,
      });

      let createdSlots = [];
      let availabilityWarning = '';
      if (bookingMode === 'with-slots' && availabilitySlotCount > 0) {
        try {
          createdSlots = await createServiceSlotsFromAvailability({
            serviceId: created.raw.id,
            sellerId,
            availability: availabilityTemplate,
            weeksToCreate: 7,
          });
        } catch (error) {
          console.error('Create service availability failed:', error);
          availabilityWarning = error?.message || 'Availability slots could not be saved.';
        }
      }

      setSellerDbServices((prev) => [created.raw, ...(prev || [])]);
      setWorkerServices((prev) => [created.mapped, ...(prev || [])]);
      setActiveServiceIndex(0);
      setNewService(createDefaultNewService());
      setSuccessMessage(
        availabilityWarning
          ? 'Service created. Availability needs attention.'
          : createdSlots.length > 0
            ? `Service created with ${createdSlots.length} availability slots`
            : 'Service created successfully'
      );
      if (availabilityWarning) {
        setSellerDataError(`Service created, but availability slots were not saved: ${availabilityWarning}`);
      }
      window.setTimeout(() => setSuccessMessage(''), 3000);
      closeCreateService();
      return created.raw;
    } catch (error) {
      console.error('Create service failed:', error);
      setSellerDataError(error?.message || 'Failed to create service');
      return null;
    }
  }, [closeCreateService, newService, sellerData, sellerId, sellerProfile]);

  const handleSaveProfileEdit = useCallback(async (updatedData) => {
    try {
      const merged = await updateWorkerProfile({
        userId: authUser?.id,
        profileData: updatedData,
      });

      if (merged) setWorkerProfileBundle(merged);

      setWorkerServices((prev) => {
        const next = [...(prev || [])];
        next[activeServiceIndex] = {
          ...next[activeServiceIndex],
          ...updatedData,
        };
        return next;
      });

      setSuccessMessage('Profile updated');
      window.setTimeout(() => setSuccessMessage(''), 3000);
      return merged;
    } catch (error) {
      console.error('Failed to save profile edit:', error);
      setSellerDataError(error?.message || 'Failed to update profile');
      return null;
    }
  }, [activeServiceIndex, authUser?.id]);

  return {
    activeServiceIndex,
    authUser,
    closeCreateService,
    currentProfile: withWorkerPreferences(currentProfile, sellerUiProfile),
    handleCreateServiceChange,
    handleCreateServiceSubmit,
    handleSaveProfileEdit,
    hasSellerRecord,
    hasService,
    isCreateServiceOpen,
    isLoadingSellerData,
    newService,
    refreshWorkData,
    sellerData,
    sellerDataError,
    sellerDbServices,
    sellerId,
    sellerRatingAggregate,
    sellerUiProfile,
    setActiveServiceIndex,
    setIsCreateServiceOpen,
    setSellerDataError,
    setSuccessMessage,
    showSetupBanner,
    successMessage,
    workerProfileBundle,
    workerServices,
  };
};

export default useWorkProfileServices;
