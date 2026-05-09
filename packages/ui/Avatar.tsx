import { Image, Text, View } from "react-native";

export type AvatarProps = {
  uri?: string | null;
  name?: string;
  size?: number;
};

function initialsFor(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={dimension}
        accessibilityLabel={name ? `Avatar pentru ${name}` : "Avatar"}
      />
    );
  }

  return (
    <View
      style={dimension}
      className="bg-brand-500/15 items-center justify-center"
    >
      <Text className="text-brand-600 font-semibold">{initialsFor(name)}</Text>
    </View>
  );
}
