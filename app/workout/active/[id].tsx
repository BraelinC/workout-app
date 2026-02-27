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
  Modal,
  FlatList,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Id } from "../../../convex/_generated/dataModel";

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useQuery(api.sessions.get, { id: id as Id<"workoutSessions"> });
  const progress = useQuery(api.sessions.getProgress, { id: id as Id<"workoutSessions"> });
  const pastExercises = useQuery(api.sessions.getPastExercises);
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
  
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseSets, setNewExerciseSets] = useState("3");
  const [newExerciseReps, setNewExerciseReps] = useState("10");
  const [newExerciseImage, setNewExerciseImage] = useState<string | null>(null);
  const [newExerciseStorageId, setNewExerciseStorageId] = useState<Id<"_storage"> | null>(null);

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

  const handleAddExercise = async () => {
    if (!newExerciseName.trim()) {
      Alert.alert("Error", "Please enter an exercise name");
      return;
    }
    
    await addExercise({
      sessionId: id as Id<"workoutSessions">,
      name: newExerciseName.trim(),
      sets: parseInt(newExerciseSets) || 3,
      reps: parseInt(newExerciseReps) || 10,
      imageStorageId: newExerciseStorageId ?? undefined,
    });
    
    setNewExerciseName("");
    setNewExerciseSets("3");
    setNewExerciseReps("10");
    setNewExerciseImage(null);
    setNewExerciseStorageId(null);
    setShowAddExercise(false);
  };

  const handleSelectPastExercise = (exercise: { name: string; lastWeight?: number; lastReps: number; imageUrl?: string | null }) => {
    setNewExerciseName(exercise.name);
    setNewExerciseReps(exercise.lastReps.toString());
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera access is required to take exercise photos");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setNewExerciseImage(uri);
      try {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uri);
        const blob = await response.blob();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/jpeg" },
          body: blob,
        });
        const { storageId } = await uploadResponse.json();
        setNewExerciseStorageId(storageId);
      } catch (err) {
        console.log("Image upload failed:", err);
      }
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
                    style={styles.exerciseThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>{exerciseIndex + 1}</Text>
                  </View>
                )}
                <Text style={styles.exerciseName}>{exercise.name}</Text>
              </View>

              {/* Sets */}
              <View style={styles.setsContainer}>
                <View style={styles.setsHeader}>
                  <Text style={styles.setHeaderText}>Set</Text>
                  <Text style={styles.setHeaderText}>Weight</Text>
                  <Text style={styles.setHeaderText}>Reps</Text>
                  <Text style={styles.setHeaderText}>Done</Text>
                </View>

                {exercise.sets?.map((set) => (
                  <View key={set._id} style={styles.setRow}>
                    <Text style={styles.setNumber}>{set.setNumber}</Text>

                    {editingSet?.id === set._id ? (
                      <>
                        <TextInput
                          style={styles.setInput}
                          value={editingSet.weight}
                          onChangeText={(text) =>
                            setEditingSet({ ...editingSet, weight: text })
                          }
                          keyboardType="numeric"
                          placeholder="lbs"
                          placeholderTextColor="#666"
                        />
                        <TextInput
                          style={styles.setInput}
                          value={editingSet.reps}
                          onChangeText={(text) =>
                            setEditingSet({ ...editingSet, reps: text })
                          }
                          keyboardType="numeric"
                          placeholder="reps"
                          placeholderTextColor="#666"
                        />
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={handleUpdateSet}
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.setValue}
                          onPress={() =>
                            setEditingSet({
                              id: set._id,
                              weight: set.weight?.toString() || "",
                              reps: set.reps.toString(),
                            })
                          }
                        >
                          <Text style={styles.setValueText}>
                            {set.weight || "-"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.setValue}
                          onPress={() =>
                            setEditingSet({
                              id: set._id,
                              weight: set.weight?.toString() || "",
                              reps: set.reps.toString(),
                            })
                          }
                        >
                          <Text style={styles.setValueText}>{set.reps}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.checkButton,
                            set.completed && styles.checkButtonCompleted,
                          ]}
                          onPress={() => handleToggleSet(set._id, set.completed)}
                        >
                          <Text
                            style={[
                              styles.checkText,
                              set.completed && styles.checkTextCompleted,
                            ]}
                          >
                            {set.completed ? "✓" : ""}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addSetButton}
                  onPress={() => handleAddSet(exercise._id)}
                >
                  <Text style={styles.addSetText}>+ Add Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Add Exercise Button */}
        {!session.completed && (
          <TouchableOpacity
            style={styles.addExerciseButton}
            onPress={() => setShowAddExercise(true)}
          >
            <Text style={styles.addExerciseText}>+ Add Exercise</Text>
          </TouchableOpacity>
        )}

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

        {/* Add Exercise Modal */}
        <Modal
          visible={showAddExercise}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAddExercise(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Exercise</Text>

              {/* Past Exercises Picker */}
              <View style={styles.pastExercisesContainer}>
                <Text style={styles.pastExercisesLabel}>Previous Exercises</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={[{ _isNew: true as const, name: "", lastReps: 0 }, ...(pastExercises ?? [])] as Array<{ _isNew?: true; name: string; lastReps: number; lastWeight?: number; imageUrl?: string | null }>}
                  keyExtractor={(item, index) => item._isNew ? "__new__" : `${item.name}-${index}`}
                  contentContainerStyle={styles.pastExercisesList}
                  renderItem={({ item }) => {
                    if (item._isNew) {
                      return (
                        <TouchableOpacity style={styles.pastExerciseChip} onPress={handleTakePhoto}>
                          {newExerciseImage ? (
                            <Image source={{ uri: newExerciseImage }} style={styles.pastExerciseImage} resizeMode="cover" />
                          ) : (
                            <View style={[styles.pastExerciseImagePlaceholder, { backgroundColor: "#1a2a4a" }]}>
                              <Text style={{ fontSize: 28 }}>📷</Text>
                            </View>
                          )}
                          <Text style={[styles.pastExerciseChipText, { color: "#60a5fa" }]} numberOfLines={1}>
                            {newExerciseImage ? "Photo ✓" : "New"}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity
                        style={[
                          styles.pastExerciseChip,
                          newExerciseName === item.name && styles.pastExerciseChipSelected,
                        ]}
                        onPress={() => handleSelectPastExercise(item)}
                      >
                        {item.imageUrl ? (
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.pastExerciseImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.pastExerciseImagePlaceholder}>
                            <Text style={styles.pastExerciseImagePlaceholderText}>💪</Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.pastExerciseChipText,
                            newExerciseName === item.name && styles.pastExerciseChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {item.lastWeight && (
                          <Text style={styles.pastExerciseSubtext}>
                            {item.lastWeight} lbs
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>

              {/* Manual Entry */}
              <TextInput
                style={styles.input}
                placeholder="Or type new exercise name"
                placeholderTextColor="#666"
                value={newExerciseName}
                onChangeText={setNewExerciseName}
              />

              <View style={styles.setsRepsContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Sets</Text>
                  <TextInput
                    style={styles.smallInput}
                    value={newExerciseSets}
                    onChangeText={setNewExerciseSets}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reps</Text>
                  <TextInput
                    style={styles.smallInput}
                    value={newExerciseReps}
                    onChangeText={setNewExerciseReps}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddExercise(false);
                    setNewExerciseName("");
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddExercise}>
                  <LinearGradient
                    colors={["#4f46e5", "#7c3aed"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSaveButton}
                  >
                    <Text style={styles.modalSaveText}>Add</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
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
    marginBottom: 16,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(79, 70, 229, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  exerciseNumberText: {
    color: "#818cf8",
    fontSize: 14,
    fontWeight: "700",
  },
  exerciseThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  setsContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 12,
    padding: 12,
  },
  setsHeader: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 8,
  },
  setHeaderText: {
    flex: 1,
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    fontWeight: "600",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  setNumber: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  setValue: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  setValueText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  setInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    marginHorizontal: 4,
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
  },
  checkButton: {
    flex: 1,
    height: 36,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  checkButtonCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.3)",
    borderColor: "#10b981",
  },
  checkText: {
    fontSize: 18,
    color: "#9ca3af",
    fontWeight: "700",
  },
  checkTextCompleted: {
    color: "#10b981",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  saveButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  addSetButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  addSetText: {
    color: "#818cf8",
    fontSize: 14,
    fontWeight: "600",
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
  // Add Exercise Button & Modal
  addExerciseButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#818cf8",
    borderStyle: "dashed",
  },
  addExerciseText: {
    color: "#818cf8",
    fontSize: 16,
    fontWeight: "600",
  },
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
  pastExercisesContainer: {
    marginBottom: 16,
  },
  pastExercisesLabel: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 10,
  },
  pastExercisesList: {
    paddingRight: 16,
  },
  pastExerciseChip: {
    width: 90,
    borderRadius: 12,
    backgroundColor: '#1e1e3a',
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 10,
    padding: 0,
    overflow: 'hidden',
    alignItems: 'center',
  },
  pastExerciseChipSelected: {
    backgroundColor: "rgba(79, 70, 229, 0.3)",
    borderColor: "#818cf8",
  },
  pastExerciseImage: {
    width: 90,
    height: 70,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  pastExerciseImagePlaceholder: {
    width: 90,
    height: 70,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  pastExerciseImagePlaceholderText: {
    fontSize: 28,
  },
  pastExerciseChipText: {
    paddingHorizontal: 6,
    paddingTop: 4,
    fontSize: 11,
    color: '#ccc',
  },
  pastExerciseChipTextSelected: {
    color: "#818cf8",
  },
  pastExerciseSubtext: {
    paddingHorizontal: 6,
    paddingBottom: 6,
    fontSize: 10,
    color: '#888',
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 16,
  },
  setsRepsContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 8,
  },
  smallInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  modalSaveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalSaveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
