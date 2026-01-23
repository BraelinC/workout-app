import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalSearchParams, router } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  StatusBar,
  Image,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import * as ImagePicker from "expo-image-picker";

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useQuery(api.sessions.get, { id: id as Id<"workoutSessions"> });
  const progress = useQuery(api.sessions.getProgress, { id: id as Id<"workoutSessions"> });
  const updateSet = useMutation(api.sessions.updateSet);
  const completeSession = useMutation(api.sessions.complete);
  const addSet = useMutation(api.sessions.addSet);
  const addExercise = useMutation(api.sessions.addExercise);
  const generateUploadUrl = useMutation(api.templates.generateUploadUrl);

  const [editingSet, setEditingSet] = useState<{
    id: Id<"sets">;
    weight: string;
    reps: string;
  } | null>(null);

  const [showNameModal, setShowNameModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!session) {
    return (
      <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.gradientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </LinearGradient>
    );
  }

  const handleToggleSet = async (setId: Id<"sets">, completed: boolean) => {
    await updateSet({ id: setId, completed: !completed });
  };

  const handleUpdateSet = async () => {
    if (!editingSet) return;
    await updateSet({
      id: editingSet.id,
      weight: editingSet.weight ? parseFloat(editingSet.weight) : undefined,
      reps: editingSet.reps ? parseInt(editingSet.reps) : undefined,
    });
    setEditingSet(null);
  };

  const handleAddSet = async (sessionExerciseId: Id<"sessionExercises">) => {
    await addSet({
      sessionExerciseId,
      reps: 10,
    });
  };

  const handleOpenCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImageUri(result.assets[0].uri);
      setShowNameModal(true);
    }
  };

  const handleAddExercise = async () => {
    if (!newExerciseName.trim()) {
      Alert.alert("Error", "Please enter an exercise name");
      return;
    }

    setIsUploading(true);
    try {
      let imageStorageId: Id<"_storage"> | undefined;

      // Upload image if we have one
      if (capturedImageUri) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(capturedImageUri);
        const blob = await response.blob();

        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/jpeg" },
          body: blob,
        });

        if (uploadResult.ok) {
          const { storageId } = await uploadResult.json();
          imageStorageId = storageId;
        }
      }

      await addExercise({
        sessionId: id as Id<"workoutSessions">,
        name: newExerciseName.trim(),
        sets: 1,
        reps: 10,
        imageStorageId,
      });

      setNewExerciseName("");
      setCapturedImageUri(null);
      setShowNameModal(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add exercise");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFinishWorkout = () => {
    Alert.alert(
      "Finish Workout",
      "Are you sure you want to finish this workout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finish",
          onPress: async () => {
            await completeSession({ id: id as Id<"workoutSessions"> });
            router.back();
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    const elapsed = Date.now() - timestamp;
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.gradientContainer}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.workoutName}>{session.name}</Text>
            <Text style={styles.workoutTime}>{formatTime(session.date)}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Progress Bar */}
        {progress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={["#10b981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress.percentage}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress.completed}/{progress.total} sets ({progress.percentage}%)
            </Text>
          </View>
        )}

        {/* Exercises */}
        <ScrollView showsVerticalScrollIndicator={false} style={styles.exerciseList}>
          {session.exercises?.map((exercise, exerciseIndex) => (
            <View key={exercise._id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                {exercise.imageUrl ? (
                  <Image
                    source={{ uri: exercise.imageUrl }}
                    style={styles.exerciseImage}
                  />
                ) : (
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>{exerciseIndex + 1}</Text>
                  </View>
                )}
                <Text style={styles.exerciseName}>{exercise.name}</Text>
              </View>

              {/* Sets - Clean single bar style */}
              {exercise.sets?.map((set) => (
                <TouchableOpacity
                  key={set._id}
                  style={[
                    styles.setBar,
                    set.completed && styles.setBarCompleted,
                  ]}
                  onPress={() => handleToggleSet(set._id, set.completed)}
                  onLongPress={() =>
                    setEditingSet({
                      id: set._id,
                      weight: set.weight?.toString() || "",
                      reps: set.reps.toString(),
                    })
                  }
                >
                  {editingSet?.id === set._id ? (
                    <View style={styles.setBarEditing}>
                      <Text style={styles.setBarNumber}>Set {set.setNumber}</Text>
                      <TextInput
                        style={styles.setBarInput}
                        value={editingSet.weight}
                        onChangeText={(text) =>
                          setEditingSet({ ...editingSet, weight: text })
                        }
                        keyboardType="numeric"
                        placeholder="lbs"
                        placeholderTextColor="#666"
                      />
                      <Text style={styles.setBarX}>x</Text>
                      <TextInput
                        style={styles.setBarInput}
                        value={editingSet.reps}
                        onChangeText={(text) =>
                          setEditingSet({ ...editingSet, reps: text })
                        }
                        keyboardType="numeric"
                        placeholder="reps"
                        placeholderTextColor="#666"
                      />
                      <TouchableOpacity
                        style={styles.setBarSave}
                        onPress={handleUpdateSet}
                      >
                        <Text style={styles.setBarSaveText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.setBarContent}>
                      <Text style={styles.setBarNumber}>Set {set.setNumber}</Text>
                      <View style={styles.setBarValues}>
                        <Text style={styles.setBarWeight}>
                          {set.weight ? `${set.weight} lbs` : "- lbs"}
                        </Text>
                        <Text style={styles.setBarX}>x</Text>
                        <Text style={styles.setBarReps}>{set.reps} reps</Text>
                      </View>
                      <View style={[
                        styles.setBarCheck,
                        set.completed && styles.setBarCheckCompleted,
                      ]}>
                        <Text style={[
                          styles.setBarCheckText,
                          set.completed && styles.setBarCheckTextCompleted,
                        ]}>
                          {set.completed ? "✓" : ""}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {/* Add Set Button - More prominent */}
              <TouchableOpacity
                style={styles.addSetBar}
                onPress={() => handleAddSet(exercise._id)}
              >
                <Text style={styles.addSetBarText}>+ Add Set</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Exercise Button */}
          {!session.completed && (
            <TouchableOpacity
              style={styles.addExerciseCard}
              onPress={handleOpenCamera}
            >
              <Text style={styles.addExerciseText}>+ Add Exercise</Text>
            </TouchableOpacity>
          )}

          {/* Empty state */}
          {(!session.exercises || session.exercises.length === 0) && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No exercises yet</Text>
              <Text style={styles.emptyStateText}>
                Tap "Add Exercise" to get started
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Finish Button */}
        {!session.completed && (
          <TouchableOpacity onPress={handleFinishWorkout}>
            <LinearGradient
              colors={["#10b981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.finishButton}
            >
              <Text style={styles.finishButtonText}>Finish Workout</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {session.completed && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerText}>Workout Completed!</Text>
          </View>
        )}
        </View>
      </SafeAreaView>

      {/* Exercise Name Modal (after taking photo) */}
      <Modal
        visible={showNameModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowNameModal(false);
          setCapturedImageUri(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowNameModal(false);
            setCapturedImageUri(null);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Name this exercise</Text>

            {/* Image preview */}
            {capturedImageUri && (
              <Image
                source={{ uri: capturedImageUri }}
                style={styles.imagePreview}
              />
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Exercise name (e.g., Bench Press)"
              placeholderTextColor="#666"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowNameModal(false);
                  setCapturedImageUri(null);
                  setNewExerciseName("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddExercise} disabled={isUploading}>
                <LinearGradient
                  colors={["#4f46e5", "#7c3aed"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.modalAddButton, isUploading && styles.modalAddButtonDisabled]}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalAddText}>Add</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#9ca3af",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: "#818cf8",
    fontSize: 16,
    fontWeight: "600",
  },
  headerCenter: {
    alignItems: "center",
  },
  workoutName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  workoutTime: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
  },
  headerRight: {
    width: 50,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  exerciseList: {
    flex: 1,
  },
  exerciseCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  exerciseNumber: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(79, 70, 229, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  exerciseNumberText: {
    color: "#818cf8",
    fontSize: 18,
    fontWeight: "700",
  },
  exerciseImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  // New set bar styles
  setBar: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  setBarCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  setBarContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  setBarEditing: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  setBarNumber: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    width: 50,
  },
  setBarValues: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  setBarWeight: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  setBarX: {
    color: "#6b7280",
    fontSize: 14,
    marginHorizontal: 8,
  },
  setBarReps: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  setBarInput: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    width: 70,
  },
  setBarSave: {
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 8,
  },
  setBarSaveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  setBarCheck: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  setBarCheckCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.3)",
    borderColor: "#10b981",
  },
  setBarCheckText: {
    fontSize: 16,
    color: "#9ca3af",
    fontWeight: "700",
  },
  setBarCheckTextCompleted: {
    color: "#10b981",
  },
  // Add Set button - more prominent
  addSetBar: {
    backgroundColor: "rgba(79, 70, 229, 0.15)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.3)",
    borderStyle: "dashed",
  },
  addSetBarText: {
    color: "#818cf8",
    fontSize: 15,
    fontWeight: "600",
  },
  // Add Exercise card
  addExerciseCard: {
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(79, 70, 229, 0.3)",
    borderStyle: "dashed",
  },
  addExerciseText: {
    color: "#818cf8",
    fontSize: 17,
    fontWeight: "700",
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyStateText: {
    color: "#9ca3af",
    fontSize: 16,
  },
  finishButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  finishButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  completedBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  completedBannerText: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "700",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1f2937",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#4b5563",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  modalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    marginBottom: 20,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 16,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "600",
  },
  modalAddButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  modalAddButtonDisabled: {
    opacity: 0.6,
  },
  modalAddText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
