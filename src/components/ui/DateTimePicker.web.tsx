import { Controller, ControllerProps, FieldValues } from "react-hook-form";
import type { DatePickerOptions } from "@react-native-community/datetimepicker";
import { PropsWithChildren } from "react";
import { Text, View } from "react-native";

/**
 * Web counterpart of `DateTimePicker.tsx`.
 *
 * `@react-native-community/datetimepicker` renders nothing in the browser, so
 * the web build uses a native `<input type="date">` instead. The public props
 * are unchanged, which keeps the form screens identical across platforms.
 */
type DataTimePickerProps<T extends FieldValues> = { label?: string } & Omit<
  ControllerProps<T>,
  "render"
> &
  Omit<DatePickerOptions, "value" | "onChange">;

const toInputValue = (value: unknown) => {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : undefined;

  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  // `YYYY-MM-DD` in local time, which is what <input type="date"> expects.
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const DataTimePicker = <T extends FieldValues>({
  label,
  minimumDate,
  maximumDate,
  disabled,
  control,
  name,
  rules,
  defaultValue,
  shouldUnregister,
}: PropsWithChildren<DataTimePickerProps<T>>) => (
  <View className="gap-y-2">
    {label && <Text className="font-semibold">{label}</Text>}
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      shouldUnregister={shouldUnregister}
      disabled={disabled}
      render={({ field: { onChange, onBlur, value } }) => (
        <input
          type="date"
          value={toInputValue(value)}
          min={minimumDate ? toInputValue(minimumDate) : undefined}
          max={maximumDate ? toInputValue(maximumDate) : undefined}
          disabled={disabled}
          onBlur={onBlur}
          onChange={(event) =>
            onChange(
              event.target.value
                ? new Date(`${event.target.value}T00:00:00`)
                : undefined,
            )
          }
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "16px 12px",
            borderRadius: 8,
            border: "1px solid #9ca3af",
            backgroundColor: "transparent",
            fontFamily: "inherit",
            fontSize: 14,
            letterSpacing: "0.025em",
            color: disabled ? "#9ca3af" : "inherit",
          }}
        />
      )}
    />
  </View>
);

export { DataTimePicker };
