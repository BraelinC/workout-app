import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { Link, router } from "expo-router";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  StatusBar,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";

type Template = {
  _id: Id<"workoutTemplates">;
  name: string;
  createdAt: number;
  exercises?: Array<{
    _id: Id<"templateExercises">;
    name: string;
    defaultSets: number;
    defaultReps: number;
    imageUrl: string | null;
  }>;
};

export default function HomeScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const templates = useQuery(api.templates.list);
  const recentSessions = useQuery(api.sessions.listRecent, { limit: 5 });
  const activeSession = useQuery(api.sessions.getActive);
  const createTemplate = useMutation(api.templates.create);
  const deleteTemplate = useMutation(api.templates.remove);
  const startSession = useMutation(api.sessions.start);
  const startQuickWorkout = useMutation(api.sessions.startQuick);
  const addExercise = useMutation(api.templates.addExercise);

  const [newTemplateName, setNewTemplateName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newExercises, setNewExercises] = useState<Array<{
    name: string;
    defaultSets: string;
    defaultReps: string;
  }>>([]);
  const [currentExercise, setCurrentExercise] = useState({
    name: "",
    defaultSets: "3",
    defaultReps: "10",
  });

  // Get full template with exercises for preview
  const templateDetail = useQuery(
    api.templates.get,
    selectedTemplate ? { id: selectedTemplate._id } : "skip"
  );

  if (isLoading) {
    return (
      <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.gradientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.heroContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!isAuthenticated) {
    return (
      <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.gradientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.heroContainer}>
          <Text style={styles.heroTitle}>Workout Tracker</Text>
          <Text style={styles.heroSubtitle}>Track your workouts with templates</Text>

          <Link href="/sign-in" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <LinearGradient
                colors={["#4f46e5", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.primaryButtonText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Link>

          <Link href="/sign-up" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Create Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </LinearGradient>
    );
  }

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      Alert.alert("Error", "Please enter a template name");
      return;
    }
    if (newExercises.length === 0) {
      Alert.alert("Error", "Please add at least one exercise");
      return;
    }
    try {
      const templateId = await createTemplate({ name: newTemplateName.trim() });

      // Add all exercises to the template
      for (const exercise of newExercises) {
        await addExercise({
          templateId,
          name: exercise.name,
          defaultSets: parseInt(exercise.defaultSets) || 3,
          defaultReps: parseInt(exercise.defaultReps) || 10,
        });
      }

      // Reset state
      setNewTemplateName("");
      setNewExercises([]);
      setCurrentExercise({ name: "", defaultSets: "3", defaultReps: "10" });
      setShowCreateModal(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create template");
    }
  };

  const handleAddExerciseToNew = () => {
    if (!currentExercise.name.trim()) {
      Alert.alert("Error", "Please enter an exercise name");
      return;
    }
    setNewExercises([...newExercises, { ...currentExercise }]);
    setCurrentExercise({ name: "", defaultSets: "3", defaultReps: "10" });
  };

  const handleRemoveExerciseFromNew = (index: number) => {
    setNewExercises(newExercises.filter((_, i) => i !== index));
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewTemplateName("");
    setNewExercises([]);
    setCurrentExercise({ name: "", defaultSets: "3", defaultReps: "10" });
  };

  const handleDeleteTemplate = (id: Id<"workoutTemplates">, name: string) => {
    Alert.alert(
      "Delete Template",
      `Are you sure you want to delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteTemplate({ id }),
        },
      ]
    );
  };

  const handleStartWorkout = async () => {
    if (!selectedTemplate) return;
    try {
      const sessionId = await startSession({ templateId: selectedTemplate._id });
      setShowPreview(false);
      setSelectedTemplate(null);
      router.push(`/workout/active/${sessionId}`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start workout");
    }
  };

  const handleStartQuickWorkout = async () => {
    try {
      const sessionId = await startQuickWorkout({});
      router.push(`/workout/active/${sessionId}`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start workout");
    }
  };

  const openPreview = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    const minutes = Math.floor(duration / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.gradientContainer}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.welcomeName}>{user?.firstName || "Workout"}</Text>
          </View>

          {/* Start Workout Button */}
          <TouchableOpacity
            style={styles.startWorkoutContainer}
            onPress={handleStartQuickWorkout}
          >
            <LinearGradient
              colors={["#10b981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startWorkoutButton}
            >
              <Text style={styles.startWorkoutText}>Start Workout</Text>
            </LinearGradient>
          </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Recent Sessions */}
          {recentSessions && recentSessions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Workouts</Text>
              {recentSessions.slice(0, 3).map((session) => (
                <TouchableOpacity
                  key={session._id}
                  style={styles.sessionCard}
                  onPress={() => router.push(`/workout/active/${session._id}`)}
                >
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionName}>{session.name}</Text>
                    <Text style={styles.sessionDate}>
                      {formatDate(session.date)}
                      {session.completedAt && ` - ${formatDuration(session.date, session.completedAt)}`}
                    </Text>
                  </View>
                  {session.completed ? (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedText}>Done</Text>
                    </View>
                  ) : (
                    <View style={styles.inProgressBadge}>
                      <Text style={styles.inProgressText}>In Progress</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Templates */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Workout Templates</Text>
            </View>

            <TouchableOpacity
              style={styles.addButtonContainer}
              onPress={() => setShowCreateModal(true)}
            >
              <LinearGradient
                colors={["#4f46e5", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButton}
              >
                <Text style={styles.addButtonText}>+ New Template</Text>
              </LinearGradient>
            </TouchableOpacity>

            {templates?.map((template) => (
              <TouchableOpacity
                key={template._id}
                style={styles.templateCard}
                onPress={() => openPreview(template)}
                onLongPress={() => handleDeleteTemplate(template._id, template.name)}
                activeOpacity={0.7}
              >
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateDate}>
                    Created {formatDate(template.createdAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => router.push(`/template/${template._id}`)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {(!templates || templates.length === 0) && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No templates yet</Text>
                <Text style={styles.emptySubtext}>Create a template to get started!</Text>
              </View>
            )}
          </View>
        </ScrollView>
        </View>
      </SafeAreaView>

      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPreview(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPreview(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{selectedTemplate?.name}</Text>

            {templateDetail?.exercises && templateDetail.exercises.length > 0 ? (
              <ScrollView style={styles.exerciseList}>
                {templateDetail.exercises.map((exercise, index) => (
                  <View key={exercise._id} style={styles.exerciseItem}>
                    <View style={styles.exerciseNumber}>
                      <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.exerciseDetails}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseSets}>
                        {exercise.defaultSets} sets x {exercise.defaultReps} reps
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noExercises}>
                <Text style={styles.noExercisesText}>No exercises in this template</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowPreview(false);
                    router.push(`/template/${selectedTemplate?._id}`);
                  }}
                >
                  <Text style={styles.addExercisesLink}>Add exercises</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPreview(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleStartWorkout}
                disabled={!templateDetail?.exercises?.length}
              >
                <LinearGradient
                  colors={templateDetail?.exercises?.length ? ["#10b981", "#059669"] : ["#374151", "#374151"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startButton}
                >
                  <Text style={styles.startButtonText}>Start Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Create Template Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseCreateModal}
      >
        <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.gradientContainer}>
          <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <View style={styles.createModalContainer}>
              {/* Header */}
              <View style={styles.createModalHeader}>
                <TouchableOpacity onPress={handleCloseCreateModal}>
                  <Text style={styles.createModalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.createModalTitle}>New Template</Text>
                <TouchableOpacity onPress={handleCreateTemplate}>
                  <Text style={styles.createModalSave}>Save</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.createModalContent}>
                {/* Template Name */}
                <Text style={styles.createModalLabel}>Template Name</Text>
                <TextInput
                  style={styles.createModalInput}
                  placeholder="e.g., Push Day, Leg Day"
                  placeholderTextColor="#666"
                  value={newTemplateName}
                  onChangeText={setNewTemplateName}
                />

                {/* Exercises List */}
                <Text style={styles.createModalLabel}>Exercises</Text>
                {newExercises.map((exercise, index) => (
                  <View key={index} style={styles.createExerciseItem}>
                    <View style={styles.createExerciseInfo}>
                      <Text style={styles.createExerciseName}>{exercise.name}</Text>
                      <Text style={styles.createExerciseSets}>
                        {exercise.defaultSets} sets x {exercise.defaultReps} reps
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveExerciseFromNew(index)}
                      style={styles.createExerciseRemove}
                    >
                      <Text style={styles.createExerciseRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add Exercise Form */}
                <View style={styles.addExerciseForm}>
                  <TextInput
                    style={styles.createModalInput}
                    placeholder="Exercise name"
                    placeholderTextColor="#666"
                    value={currentExercise.name}
                    onChangeText={(text) => setCurrentExercise({ ...currentExercise, name: text })}
                  />
                  <View style={styles.setsRepsRow}>
                    <View style={styles.setsRepsInput}>
                      <Text style={styles.setsRepsLabel}>Sets</Text>
                      <TextInput
                        style={styles.smallInput}
                        value={currentExercise.defaultSets}
                        onChangeText={(text) => setCurrentExercise({ ...currentExercise, defaultSets: text })}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.setsRepsInput}>
                      <Text style={styles.setsRepsLabel}>Reps</Text>
                      <TextInput
                        style={styles.smallInput}
                        value={currentExercise.defaultReps}
                        onChangeText={(text) => setCurrentExercise({ ...currentExercise, defaultReps: text })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.addExerciseButton}
                    onPress={handleAddExerciseToNew}
                  >
                    <Text style={styles.addExerciseButtonText}>+ Add Exercise</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </Modal>

      {/* Active Workout Bottom Bar */}
      {activeSession && (
        <TouchableOpacity
          style={styles.activeWorkoutBar}
          onPress={() => router.push(`/workout/active/${activeSession._id}`)}
        >
          <View style={styles.activeWorkoutInfo}>
            <Text style={styles.activeWorkoutName}>{activeSession.name}</Text>
            {activeSession.currentExercise ? (
              <Text style={styles.activeWorkoutExercise}>
                {activeSession.currentExercise.name} - Set {activeSession.currentExercise.completedSets + 1}/{activeSession.currentExercise.totalSets}
              </Text>
            ) : (
              <Text style={styles.activeWorkoutExercise}>All sets completed!</Text>
            )}
          </View>
          <View style={styles.activeWorkoutProgress}>
            <Text style={styles.activeWorkoutPercent}>{activeSession.progress.percentage}%</Text>
          </View>
        </TouchableOpacity>
      )}
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
    paddingTop: 8,
  },
  heroContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  loadingText: {
    fontSize: 18,
    color: "#9ca3af",
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 50,
  },
  primaryButton: {
    width: "100%",
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryButton: {
    width: "100%",
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  header: {
    marginBottom: 16,
  },
  welcomeName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  startWorkoutContainer: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
  },
  startWorkoutButton: {
    paddingVertical: 22,
    alignItems: "center",
    borderRadius: 20,
  },
  startWorkoutText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  sessionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 13,
    color: "#9ca3af",
  },
  completedBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
  },
  inProgressBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inProgressText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "600",
  },
  inputCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  inputButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
  },
  cancelButtonText: {
    color: "#9ca3af",
    fontSize: 15,
    fontWeight: "600",
  },
  createButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  addButtonContainer: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  addButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  templateCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  templateDate: {
    fontSize: 13,
    color: "#9ca3af",
  },
  editButton: {
    backgroundColor: "rgba(79, 70, 229, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: "#818cf8",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6b7280",
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
    maxHeight: "70%",
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
  exerciseList: {
    maxHeight: 300,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
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
  exerciseDetails: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  exerciseSets: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },
  noExercises: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noExercisesText: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 12,
  },
  addExercisesLink: {
    fontSize: 16,
    color: "#818cf8",
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
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
  startButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  // Active workout bottom bar
  activeWorkoutBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(79, 70, 229, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  activeWorkoutInfo: {
    flex: 1,
  },
  activeWorkoutName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  activeWorkoutExercise: {
    fontSize: 14,
    color: "#818cf8",
    fontWeight: "500",
  },
  activeWorkoutProgress: {
    backgroundColor: "rgba(79, 70, 229, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeWorkoutPercent: {
    fontSize: 16,
    fontWeight: "700",
    color: "#818cf8",
  },
  // Create Template Modal styles
  createModalContainer: {
    flex: 1,
    padding: 20,
  },
  createModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  createModalCancel: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "600",
  },
  createModalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  createModalSave: {
    color: "#818cf8",
    fontSize: 16,
    fontWeight: "700",
  },
  createModalContent: {
    flex: 1,
  },
  createModalLabel: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
  },
  createModalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
  },
  createExerciseItem: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  createExerciseInfo: {
    flex: 1,
  },
  createExerciseName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  createExerciseSets: {
    color: "#9ca3af",
    fontSize: 14,
  },
  createExerciseRemove: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  createExerciseRemoveText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  addExerciseForm: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderStyle: "dashed",
  },
  setsRepsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  setsRepsInput: {
    flex: 1,
  },
  setsRepsLabel: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 6,
  },
  smallInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  addExerciseButton: {
    backgroundColor: "rgba(79, 70, 229, 0.2)",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    alignItems: "center",
  },
  addExerciseButtonText: {
    color: "#818cf8",
    fontSize: 16,
    fontWeight: "600",
  },
});
