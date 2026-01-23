import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import * as ImagePicker from "expo-image-picker";

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const template = useQuery(api.templates.get, { id: id as Id<"workoutTemplates"> });
  const updateTemplate = useMutation(api.templates.update);
  const addExercise = useMutation(api.templates.addExercise);
  const updateExercise = useMutation(api.templates.updateExercise);
  const removeExercise = useMutation(api.templates.removeExercise);
  const generateUploadUrl = useMutation(api.templates.generateUploadUrl);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExercise, setNewExercise] = useState({
    name: "",
    defaultSets: "3",
    defaultReps: "10",
    imageUri: null as string | null,
  });
  const [editingName, setEditingName] = useState(false);
  const [templateName, setTemplateName] = useState("");

  if (!template) {
    return (
      <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.gradientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading template...</Text>
        </View>
      </LinearGradient>
    );
  }

  const handleSaveTemplateName = async () => {
    if (templateName.trim()) {
      await updateTemplate({ id: id as Id<"workoutTemplates">, name: templateName.trim() });
    }
    setEditingName(false);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewExercise({ ...newExercise, imageUri: result.assets[0].uri });
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Camera permission is needed to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewExercise({ ...newExercise, imageUri: result.assets[0].uri });
    }
  };

  const uploadImage = async (imageUri: string): Promise<Id<"_storage"> | undefined> => {
    try {
      const uploadUrl = await generateUploadUrl();

      const response = await fetch(imageUri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });

      const { storageId } = await uploadResponse.json();
      return storageId;
    } catch (error) {
      console.error("Failed to upload image:", error);
      return undefined;
    }
  };

  const handleAddExercise = async () => {
    if (!newExercise.name.trim()) {
      Alert.alert("Error", "Please enter an exercise name");
      return;
    }

    let imageStorageId: Id<"_storage"> | undefined;
    if (newExercise.imageUri) {
      imageStorageId = await uploadImage(newExercise.imageUri);
    }

    await addExercise({
      templateId: id as Id<"workoutTemplates">,
      name: newExercise.name.trim(),
      defaultSets: parseInt(newExercise.defaultSets) || 3,
      defaultReps: parseInt(newExercise.defaultReps) || 10,
      imageStorageId,
    });

    setNewExercise({
      name: "",
      defaultSets: "3",
      defaultReps: "10",
      imageUri: null,
    });
    setShowAddExercise(false);
  };

  const handleDeleteExercise = (exerciseId: Id<"templateExercises">, name: string) => {
    Alert.alert(
      "Delete Exercise",
      `Are you sure you want to delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeExercise({ id: exerciseId }),
        },
      ]
    );
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

          {editingName ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.editNameInput}
                value={templateName}
                onChangeText={setTemplateName}
                autoFocus
                onBlur={handleSaveTemplateName}
                onSubmitEditing={handleSaveTemplateName}
              />
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setTemplateName(template.name);
                setEditingName(true);
              }}
            >
              <Text style={styles.templateName}>{template.name}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.headerRight} />
        </View>

        {/* Exercises List */}
        <ScrollView showsVerticalScrollIndicator={false} style={styles.exerciseList}>
          {template.exercises?.map((exercise, index) => (
            <TouchableOpacity
              key={exercise._id}
              style={styles.exerciseCard}
              onLongPress={() => handleDeleteExercise(exercise._id, exercise.name)}
            >
              <View style={styles.exerciseContent}>
                {exercise.imageUrl ? (
                  <Image
                    source={{ uri: exercise.imageUrl }}
                    style={styles.exerciseImage}
                  />
                ) : (
                  <View style={styles.exerciseImagePlaceholder}>
                    <Text style={styles.exerciseImagePlaceholderText}>
                      {index + 1}
                    </Text>
                  </View>
                )}
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseSets}>
                    {exercise.defaultSets} sets x {exercise.defaultReps} reps
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {(!template.exercises || template.exercises.length === 0) && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No exercises yet</Text>
              <Text style={styles.emptySubtext}>Add exercises to this template</Text>
            </View>
          )}
        </ScrollView>

        {/* Add Exercise Button */}
        <TouchableOpacity onPress={() => setShowAddExercise(true)}>
          <LinearGradient
            colors={["#4f46e5", "#7c3aed"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ Add Exercise</Text>
          </LinearGradient>
        </TouchableOpacity>

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

              {/* Image Picker */}
              <View style={styles.imagePickerContainer}>
                {newExercise.imageUri ? (
                  <TouchableOpacity onPress={handlePickImage}>
                    <Image
                      source={{ uri: newExercise.imageUri }}
                      style={styles.previewImage}
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.imageButtons}>
                    <TouchableOpacity
                      style={styles.imageButton}
                      onPress={handleTakePhoto}
                    >
                      <Text style={styles.imageButtonIcon}>📷</Text>
                      <Text style={styles.imageButtonText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.imageButton}
                      onPress={handlePickImage}
                    >
                      <Text style={styles.imageButtonIcon}>🖼️</Text>
                      <Text style={styles.imageButtonText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Exercise Name */}
              <TextInput
                style={styles.input}
                placeholder="Exercise name"
                placeholderTextColor="#666"
                value={newExercise.name}
                onChangeText={(text) => setNewExercise({ ...newExercise, name: text })}
              />

              {/* Sets and Reps */}
              <View style={styles.setsRepsContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Sets</Text>
                  <TextInput
                    style={styles.smallInput}
                    value={newExercise.defaultSets}
                    onChangeText={(text) =>
                      setNewExercise({ ...newExercise, defaultSets: text })
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reps</Text>
                  <TextInput
                    style={styles.smallInput}
                    value={newExercise.defaultReps}
                    onChangeText={(text) =>
                      setNewExercise({ ...newExercise, defaultReps: text })
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddExercise(false);
                    setNewExercise({
                      name: "",
                      defaultSets: "3",
                      defaultReps: "10",
                      imageUri: null,
                    });
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
      </SafeAreaView>
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
  templateName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  editNameContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  editNameInput: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 8,
    textAlign: "center",
  },
  headerRight: {
    width: 50,
  },
  exerciseList: {
    flex: 1,
  },
  exerciseCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  exerciseContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  exerciseImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 16,
  },
  exerciseImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "rgba(79, 70, 229, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  exerciseImagePlaceholderText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#818cf8",
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  exerciseSets: {
    fontSize: 14,
    color: "#9ca3af",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
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
  addButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  addButtonText: {
    color: "#fff",
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
  imagePickerContainer: {
    marginBottom: 20,
  },
  imageButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  imageButton: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    width: 100,
  },
  imageButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  imageButtonText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
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
