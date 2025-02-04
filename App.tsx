import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import TaskInputScreen from './src/screens/TaskInputScreen';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <TaskInputScreen />
    </SafeAreaView>
  );
}
