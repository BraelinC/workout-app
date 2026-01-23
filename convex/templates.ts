import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all templates for the current user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const templates = await ctx.db
      .query("workoutTemplates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return templates;
  },
});

// Get a single template with its exercises
export const get = query({
  args: { id: v.id("workoutTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) return null;

    const exercises = await ctx.db
      .query("templateExercises")
      .withIndex("by_template", (q) => q.eq("templateId", args.id))
      .collect();

    // Get image URLs for exercises
    const exercisesWithImages = await Promise.all(
      exercises.map(async (exercise) => {
        let imageUrl = null;
        if (exercise.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(exercise.imageStorageId);
        }
        return { ...exercise, imageUrl };
      })
    );

    return {
      ...template,
      exercises: exercisesWithImages.sort((a, b) => a.order - b.order),
    };
  },
});

// Create a new template
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email ?? "",
      });
      user = await ctx.db.get(userId);
    }

    const templateId = await ctx.db.insert("workoutTemplates", {
      userId: user!._id,
      name: args.name,
      createdAt: Date.now(),
    });

    return templateId;
  },
});

// Update template name
export const update = mutation({
  args: {
    id: v.id("workoutTemplates"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name });
  },
});

// Delete a template and all its exercises
export const remove = mutation({
  args: { id: v.id("workoutTemplates") },
  handler: async (ctx, args) => {
    // Delete all template exercises
    const exercises = await ctx.db
      .query("templateExercises")
      .withIndex("by_template", (q) => q.eq("templateId", args.id))
      .collect();

    for (const exercise of exercises) {
      if (exercise.imageStorageId) {
        await ctx.storage.delete(exercise.imageStorageId);
      }
      await ctx.db.delete(exercise._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Add exercise to template
export const addExercise = mutation({
  args: {
    templateId: v.id("workoutTemplates"),
    name: v.string(),
    defaultSets: v.number(),
    defaultReps: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("templateExercises")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();

    const maxOrder = exercises.length > 0
      ? Math.max(...exercises.map((e) => e.order))
      : -1;

    const exerciseId = await ctx.db.insert("templateExercises", {
      templateId: args.templateId,
      name: args.name,
      defaultSets: args.defaultSets,
      defaultReps: args.defaultReps,
      imageStorageId: args.imageStorageId,
      order: maxOrder + 1,
    });

    return exerciseId;
  },
});

// Update template exercise
export const updateExercise = mutation({
  args: {
    id: v.id("templateExercises"),
    name: v.optional(v.string()),
    defaultSets: v.optional(v.number()),
    defaultReps: v.optional(v.number()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates: Record<string, any> = {};
    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.defaultSets !== undefined) cleanUpdates.defaultSets = updates.defaultSets;
    if (updates.defaultReps !== undefined) cleanUpdates.defaultReps = updates.defaultReps;
    if (updates.imageStorageId !== undefined) cleanUpdates.imageStorageId = updates.imageStorageId;

    await ctx.db.patch(id, cleanUpdates);
  },
});

// Remove exercise from template
export const removeExercise = mutation({
  args: { id: v.id("templateExercises") },
  handler: async (ctx, args) => {
    const exercise = await ctx.db.get(args.id);
    if (exercise?.imageStorageId) {
      await ctx.storage.delete(exercise.imageStorageId);
    }
    await ctx.db.delete(args.id);
  },
});

// Generate upload URL for exercise images
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
