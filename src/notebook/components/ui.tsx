import { Pressable, Text, TextInput, View } from "react-native";
import { colors, styles } from "../styles";
export function Button({
  children,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  small = false,
}: {
  children: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        small && styles.smallButton,
        (pressed || disabled) && { opacity: 0.55 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && { color: colors.ink },
          danger && { color: "#a52a36" },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
  large = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  large?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#686D74"
        autoCapitalize="sentences"
        maxLength={large ? 100000 : multiline ? 10000 : 500}
        style={[
          styles.input,
          multiline && {
            minHeight: large ? 220 : 90,
            textAlignVertical: "top",
          },
        ]}
      />
    </View>
  );
}
export function Blank({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.muted}>{description}</Text>
    </View>
  );
}
