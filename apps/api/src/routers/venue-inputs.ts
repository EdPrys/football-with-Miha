import { z } from 'zod';
import { FieldEnvironment, FieldSurface } from '@app/db';

const optionalText = (max: number) => z.string().trim().min(1).max(max).nullish();
// These URLs are rendered as links by clients. Restrict their schemes explicitly.
export const optionalWebUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine(
    (value) => {
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    {
      message: 'Use an http or https URL',
    },
  )
  .nullish();

export const venueDetailsSchema = z.object({
  address: optionalText(300),
  latitude: z.number().finite().min(-90).max(90).nullish(),
  longitude: z.number().finite().min(-180).max(180).nullish(),
  contactPhone: optionalText(80),
  websiteUrl: optionalWebUrl,
  totalFields: z.number().int().min(0).max(10000).nullish(),
  hasChangingRooms: z.boolean().nullish(),
  hasShowers: z.boolean().nullish(),
  hasParking: z.boolean().nullish(),
});

export const fieldDetailsSchema = z.object({
  capacity: z.number().int().min(1).max(1000).nullish(),
  environment: z.nativeEnum(FieldEnvironment).nullish(),
  surface: z.nativeEnum(FieldSurface).nullish(),
  hasLighting: z.boolean().nullish(),
  lengthMeters: z.number().finite().positive().max(1000).nullish(),
  widthMeters: z.number().finite().positive().max(1000).nullish(),
});
