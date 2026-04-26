import { Tabs } from "expo-router";
import { Text, StyleSheet } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#C4813A",
        tabBarInactiveTintColor: "#B09070",
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Cook",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🍳</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: "Recipes",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>📋</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>📖</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🦫</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#FAF5EE",
    borderTopColor: "#E8D5B0",
    borderTopWidth: 1.5,
    height: 84,
    paddingBottom: 22,
    paddingTop: 8,
  },
  label: { fontSize: 11, fontWeight: "700" },
});
