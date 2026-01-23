import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
  }).index("by_clerk_id", ["clerkId"]),

  // Workout Templates - reusable workout plans
  workoutTemplates: defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Template Exercises - exercises defined in a template
  templateExercises: defineTable({
    templateId: v.id("workoutTemplates"),
    name: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    defaultSets: v.number(), // default number of sets
    defaultReps: v.number(), // default reps per set
    order: v.number(),
  }).index("by_template", ["templateId"]),

  // Workout Sessions - actual workout instances
  workoutSessions: defineTable({
    userId: v.id("users"),
    templateId: v.optional(v.id("workoutTemplates")),
    name: v.string(),
    date: v.number(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_template", ["templateId"]),

  // Session Exercises - exercises in an active/completed session
  sessionExercises: defineTable({
    sessionId: v.id("workoutSessions"),
    templateExerciseId: v.optional(v.id("templateExercises")),
    name: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    order: v.number(),
  }).index("by_session", ["sessionId"]),

  // Sets - individual sets within a session exercise
  sets: defineTable({
    sessionExerciseId: v.id("sessionExercises"),
    setNumber: v.number(),
    weight: v.optional(v.number()),
    reps: v.number(),
    completed: v.boolean(),
  }).index("by_exercise", ["sessionExerciseId"]),
});
