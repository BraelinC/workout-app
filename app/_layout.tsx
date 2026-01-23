import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexClerkProvider } from "../providers/ConvexClerkProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConvexClerkProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "#1a1a2e",
            },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="template/[id]" />
          <Stack.Screen name="workout/active/[id]" />
        </Stack>
      </ConvexClerkProvider>
    </SafeAreaProvider>
  );
}
