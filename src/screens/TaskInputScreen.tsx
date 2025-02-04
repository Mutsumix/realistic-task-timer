import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateRealTime } from '../utils/openai';

interface Task {
  id: string;
  name: string;
  estimatedTime: number;
  realTime: number;
  isRunning?: boolean;
  isPaused?: boolean;
  remainingTime?: number;
}

const STORAGE_KEY = '@tasks_key';

const TaskInputScreen = () => {
  const [taskName, setTaskName] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [timer, setTimer] = useState<NodeJS.Timer | null>(null);

  useEffect(() => {
    loadTasks();
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  const loadTasks = async () => {
    try {
      const savedTasks = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      }
    } catch (error) {
      Alert.alert('エラー', 'タスクの読み込みに失敗しました');
    }
  };

  const saveTasks = async (updatedTasks: Task[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
    } catch (error) {
      Alert.alert('エラー', 'タスクの保存に失敗しました');
    }
  };

  const handleAddTask = async () => {
    if (!taskName.trim() || !estimatedTime.trim()) {
      Alert.alert('エラー', 'タスク名と予定時間を入力してください');
      return;
    }

    const estimatedMinutes = parseInt(estimatedTime);
    const result = await calculateRealTime(taskName, estimatedMinutes);

    Alert.alert(
      '時間の見積もり',
      `予定時間: ${estimatedMinutes}分\n実際の時間: ${result.realTime}分\n\n${result.explanation}`,
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '追加',
          onPress: () => {
            let updatedTasks: Task[];
            if (editingTask) {
              updatedTasks = tasks.map(task =>
                task.id === editingTask.id
                  ? {
                      ...task,
                      name: taskName.trim(),
                      estimatedTime: estimatedMinutes,
                      realTime: result.realTime,
                    }
                  : task
              );
            } else {
              const newTask: Task = {
                id: Date.now().toString(),
                name: taskName.trim(),
                estimatedTime: estimatedMinutes,
                realTime: result.realTime,
              };
              updatedTasks = [...tasks, newTask];
            }

            setTasks(updatedTasks);
            saveTasks(updatedTasks);
            setTaskName('');
            setEstimatedTime('');
            setEditingTask(null);
          },
        },
      ]
    );
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskName(task.name);
    setEstimatedTime(task.estimatedTime.toString());
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setTaskName('');
    setEstimatedTime('');
  };

  const handleDeleteTask = async (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };

  const startTimer = (task: Task) => {
    if (activeTask && activeTask.id !== task.id) {
      Alert.alert('警告', '既に実行中のタスクがあります');
      return;
    }

    const updatedTask = {
      ...task,
      isRunning: true,
      isPaused: false,
      remainingTime: task.remainingTime || task.realTime * 60,
    };

    setActiveTask(updatedTask);
    setTasks(tasks.map(t => t.id === task.id ? updatedTask : t));

    const intervalId = setInterval(() => {
      setActiveTask(current => {
        if (!current || current.isPaused) return current;

        const newRemainingTime = (current.remainingTime || 0) - 1;
        if (newRemainingTime <= 0) {
          clearInterval(intervalId);
          Alert.alert('完了', `${current.name}が完了しました！`);
          setTimer(null);
          return null;
        }

        const updatedTask = { ...current, remainingTime: newRemainingTime };
        setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
        return updatedTask;
      });
    }, 1000);

    setTimer(intervalId);
  };

  const pauseTimer = () => {
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
    if (activeTask) {
      const updatedTask = { ...activeTask, isRunning: true, isPaused: true };
      setTasks(tasks.map(t => t.id === activeTask.id ? updatedTask : t));
      setActiveTask(updatedTask);
    }
  };

  const resetTimer = () => {
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
    if (activeTask) {
      const updatedTask = {
        ...activeTask,
        isRunning: false,
        isPaused: false,
        remainingTime: undefined
      };
      setTasks(tasks.map(t => t.id === activeTask.id ? updatedTask : t));
      setActiveTask(null);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>タスク名</Text>
          <TextInput
            style={styles.input}
            value={taskName}
            onChangeText={setTaskName}
            placeholder="タスクを入力してください"
          />

          <Text style={styles.label}>予定時間（分）</Text>
          <TextInput
            style={styles.input}
            value={estimatedTime}
            onChangeText={setEstimatedTime}
            placeholder="時間を入力してください"
            keyboardType="numeric"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.addButton, editingTask && styles.editButton]}
              onPress={handleAddTask}
            >
              <Text style={styles.buttonText}>
                {editingTask ? '更新する' : 'タスクを追加'}
              </Text>
            </TouchableOpacity>

            {editingTask && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelEdit}
              >
                <Text style={styles.buttonText}>キャンセル</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.taskListContainer}>
          <Text style={styles.sectionTitle}>タスク一覧</Text>
          {tasks.map(task => (
            <View key={task.id} style={styles.taskItem}>
              <View style={styles.taskMainInfo}>
                <Text style={styles.taskName}>{task.name}</Text>
                <View style={styles.timeInfo}>
                  <Text style={styles.taskTime}>予定時間: {task.estimatedTime}分</Text>
                  <Text style={styles.taskTime}>
                    実際の時間: {task.realTime}分
                    <Text style={styles.extraTime}>
                      （+{task.realTime - task.estimatedTime}分）
                    </Text>
                  </Text>
                </View>
              </View>
              <View style={styles.taskActions}>
                <View style={styles.timerButtons}>
                  {!task.isRunning ? (
                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={() => startTimer(task)}
                    >
                      <Text style={styles.buttonText}>開始</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      {!task.isPaused ? (
                        <TouchableOpacity
                          style={styles.pauseButton}
                          onPress={pauseTimer}
                        >
                          <Text style={styles.buttonText}>一時停止</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.startButton}
                          onPress={() => startTimer(task)}
                        >
                          <Text style={styles.buttonText}>再開</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.resetButton}
                        onPress={resetTimer}
                      >
                        <Text style={styles.buttonText}>リセット</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                <View style={styles.managementButtons}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEditTask(task)}
                  >
                    <Text style={styles.buttonText}>編集</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteTask(task.id)}
                  >
                    <Text style={styles.deleteButtonText}>削除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {activeTask && (
        <View style={styles.timerContainer}>
          <Text style={styles.timerTaskName}>
            {activeTask.name}
            {activeTask.isPaused && ' (一時停止中)'}
          </Text>
          <Text style={styles.timerText}>
            残り時間: {formatTime(activeTask.remainingTime || 0)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  inputContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  taskListContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333333',
  },
  taskItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  taskMainInfo: {
    marginBottom: 12,
  },
  taskName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskTime: {
    fontSize: 14,
    color: '#666666',
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  managementButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  pauseButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  resetButton: {
    backgroundColor: '#f44336',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelButton: {
    backgroundColor: '#666666',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  extraTime: {
    color: '#E91E63',
    fontSize: 12,
  },
  timerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#333',
    padding: 16,
    alignItems: 'center',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  timerTaskName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  timerText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default TaskInputScreen;
