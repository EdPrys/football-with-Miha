import type { AppRouterInputs } from '@app/api';
import { Input } from '@/components/ui/input';

type VenueUpdate = AppRouterInputs['venues']['update'];
type FieldUpdate = AppRouterInputs['venues']['updateField'];
export type VenueMetadata = Omit<VenueUpdate, 'id' | 'name'>;
export type FieldMetadata = Omit<FieldUpdate, 'id' | 'name'>;

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-ring';
const yesNo = [
  ['true', 'Так'],
  ['false', 'Ні'],
];
const environments = [
  ['OPEN_AIR', 'Відкрите'],
  ['COVERED', 'Під накриттям'],
  ['INDOOR', 'У приміщенні'],
];
const surfaces = [
  ['NATURAL_GRASS', 'Натуральна трава'],
  ['ARTIFICIAL_TURF', 'Штучний газон'],
  ['PARQUET', 'Паркет'],
  ['RUBBER', 'Гума'],
  ['HARD_COURT', 'Тверде покриття'],
  ['OTHER', 'Інше'],
];

function TextControl({
  name,
  label,
  value,
  type = 'text',
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        name={name}
        type={type}
        pattern={type === 'url' ? 'https?://.*' : undefined}
        title={type === 'url' ? 'Посилання має починатися з http:// або https://' : undefined}
        defaultValue={value ?? ''}
        min={min}
        max={max}
        step={step}
        className="h-9"
      />
    </label>
  );
}

function Choice({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string | boolean | null;
  options: string[][];
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select name={name} defaultValue={value == null ? '' : String(value)} className={selectClass}>
        <option value="">Невідомо</option>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VenueDetails({
  value = {},
  verification = false,
}: {
  value?: VenueMetadata;
  verification?: boolean;
}) {
  return (
    <details className="w-full rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm">Додаткові дані майданчика</summary>
      <p className="my-2 text-xs text-muted-foreground">
        Заповнюйте лише відомі дані. Порожнє значення означає «невідомо».
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TextControl name="address" label="Адреса" value={value.address} />
        <TextControl name="contactPhone" label="Телефон" type="tel" value={value.contactPhone} />
        <TextControl
          name="websiteUrl"
          label="Сайт (https://…)"
          type="url"
          value={value.websiteUrl}
        />
        <TextControl
          name="latitude"
          label="Широта"
          type="number"
          min={-90}
          max={90}
          step="any"
          value={value.latitude}
        />
        <TextControl
          name="longitude"
          label="Довгота"
          type="number"
          min={-180}
          max={180}
          step="any"
          value={value.longitude}
        />
        <TextControl
          name="totalFields"
          label="Загальна кількість полів"
          type="number"
          min={0}
          step="1"
          value={value.totalFields}
        />
        <Choice
          name="hasChangingRooms"
          label="Роздягальні"
          value={value.hasChangingRooms}
          options={yesNo}
        />
        <Choice name="hasShowers" label="Душові" value={value.hasShowers} options={yesNo} />
        <Choice name="hasParking" label="Паркування" value={value.hasParking} options={yesNo} />
        {verification && (
          <>
            <TextControl
              name="sourceUrl"
              label="Джерело (https://…)"
              type="url"
              value={value.sourceUrl}
            />
            <TextControl
              name="verifiedAt"
              label="Дата перевірки"
              type="date"
              value={value.verifiedAt ? new Date(value.verifiedAt).toISOString().slice(0, 10) : ''}
            />
          </>
        )}
      </div>
    </details>
  );
}

export function FieldDetails({ value = {} }: { value?: FieldMetadata }) {
  return (
    <details className="w-full rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm">Характеристики поля</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Choice
          name="environment"
          label="Тип поля"
          value={value.environment}
          options={environments}
        />
        <Choice name="surface" label="Покриття" value={value.surface} options={surfaces} />
        <Choice name="hasLighting" label="Освітлення" value={value.hasLighting} options={yesNo} />
        <TextControl
          name="lengthMeters"
          label="Довжина, м"
          type="number"
          min={0.01}
          step="any"
          value={value.lengthMeters}
        />
        <TextControl
          name="widthMeters"
          label="Ширина, м"
          type="number"
          min={0.01}
          step="any"
          value={value.widthMeters}
        />
      </div>
    </details>
  );
}

const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim() || null;
const number = (data: FormData, key: string) =>
  text(data, key) == null ? null : Number(text(data, key));
const boolean = (data: FormData, key: string) =>
  text(data, key) == null ? null : text(data, key) === 'true';

export function venueMetadata(data: FormData) {
  return {
    address: text(data, 'address'),
    latitude: number(data, 'latitude'),
    longitude: number(data, 'longitude'),
    contactPhone: text(data, 'contactPhone'),
    websiteUrl: text(data, 'websiteUrl'),
    totalFields: number(data, 'totalFields'),
    hasChangingRooms: boolean(data, 'hasChangingRooms'),
    hasShowers: boolean(data, 'hasShowers'),
    hasParking: boolean(data, 'hasParking'),
  };
}
export function verificationMetadata(data: FormData) {
  const date = text(data, 'verifiedAt');
  return {
    sourceUrl: text(data, 'sourceUrl'),
    verifiedAt: date ? new Date(`${date}T00:00:00.000Z`) : null,
  };
}
export function fieldMetadata(data: FormData): FieldMetadata {
  return {
    capacity: number(data, 'capacity'),
    environment: text(data, 'environment') as FieldMetadata['environment'],
    surface: text(data, 'surface') as FieldMetadata['surface'],
    hasLighting: boolean(data, 'hasLighting'),
    lengthMeters: number(data, 'lengthMeters'),
    widthMeters: number(data, 'widthMeters'),
  };
}
