import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NotebookApp } from "./src/notebook/NotebookApp";

export default function App() {
  return (
    <SafeAreaProvider>
      <NotebookApp />
    </SafeAreaProvider>
  );
}
