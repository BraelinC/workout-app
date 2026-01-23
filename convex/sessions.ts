import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get recent sessions for the current user
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return [];

    const allSessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ?? 10);

    return allSessions;
  },
});

// Get current active (incomplete) session with current exercise info
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;

    // Find the most recent incomplete session
    const activeSession = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .filter((q) => q.eq(q.field("completed"), false))
      .first();

    if (!activeSession) return null;

    // Get exercises for this session
    const exercises = await ctx.db
      .query("sessionExercises")
      .withIndex("by_session", (q) => q.eq("sessionId", activeSession._id))
      .collect();

    // Find the current exercise (first one with incomplete sets)
    let currentExercise = null;
    let completedSets = 0;
    let totalSets = 0;

    for (const exercise of exercises.sort((a, b) => a.order - b.order)) {
      const sets = await ctx.db
        .query("sets")
        .withIndex("by_exercise", (q) => q.eq("sessionExerciseId", exercise._id))
        .collect();

      totalSets += sets.length;
      const exerciseCompletedSets = sets.filter((s) => s.completed).length;
      completedSets += exerciseCompletedSets;

      // If this exercise has incomplete sets and we haven't found current yet
      if (!currentExercise && exerciseCompletedSets < sets.length) {
        currentExercise = {
          name: exercise.name,
          completedSets: exerciseCompletedSets,
          totalSets: sets.length,
        };
      }
    }

    return {
      _id: activeSession._id,
      name: activeSession.name,
      date: activeSession.date,
      currentExercise,
      progress: {
        completed: completedSets,
        total: totalSets,
        percentage: totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0,
      },
    };
  },
});

// Get a single session with all exercises and sets
export const get = query({
  args: { id: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    const template = session.templateId ? await ctx.db.get(session.templateId) : null;

    const exercises = await ctx.db
      .query("sessionExercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    // Get sets and image URLs for each exercise
    const exercisesWithSets = await Promise.all(
      exercises.map(async (exercise) => {
        const sets = await ctx.db
          .query("sets")
          .withIndex("by_exercise", (q) => q.eq("sessionExerciseId", exercise._id))
          .collect();

        let imageUrl = null;
        if (exercise.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(exercise.imageStorageId);
        }

        return {
          ...exercise,
          imageUrl,
          sets: sets.sort((a, b) => a.setNumber - b.setNumber),
        };
      })
    );

    return {
      ...session,
      templateName: template?.name ?? "Unknown",
      exercises: exercisesWithSets.sort((a, b) => a.order - b.order),
    };
  },
});

// Start a new workout session from a template
export const start = mutation({
  args: { templateId: v.id("workoutTemplates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    // Create the session
    const sessionId = await ctx.db.insert("workoutSessions", {
      userId: user._id,
      templateId: args.templateId,
      name: template.name,
      date: Date.now(),
      completed: false,
    });

    // Copy exercises from template
    const templateExercises = await ctx.db
      .query("templateExercises")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();

    for (const templateExercise of templateExercises) {
      const sessionExerciseId = await ctx.db.insert("sessionExercises", {
        sessionId,
        templateExerciseId: templateExercise._id,
        name: templateExercise.name,
        imageStorageId: templateExercise.imageStorageId,
        order: templateExercise.order,
      });

      // Create default sets based on template
      for (let i = 1; i <= templateExercise.defaultSets; i++) {
        await ctx.db.insert("sets", {
          sessionExerciseId,
          setNumber: i,
          reps: templateExercise.defaultReps,
          completed: false,
        });
      }
    }

    return sessionId;
  },
});

// Start a quick workout without a template
export const startQuick = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const now = new Date();
    const defaultName = args.name || `Workout ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    const sessionId = await ctx.db.insert("workoutSessions", {
      userId: user._id,
      name: defaultName,
      date: Date.now(),
      completed: false,
    });

    return sessionId;
  },
});

// Add an exercise to an active session
export const addExercise = mutation({
  args: {
    sessionId: v.id("workoutSessions"),
    name: v.string(),
    sets: v.optional(v.number()),
    reps: v.optional(v.number()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.completed) throw new Error("Cannot add exercises to completed workout");

    // Get current exercise count to determine order
    const existingExercises = await ctx.db
      .query("sessionExercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const order = existingExercises.length;
    const numSets = args.sets ?? 1;
    const numReps = args.reps ?? 10;

    // Create the exercise
    const exerciseId = await ctx.db.insert("sessionExercises", {
      sessionId: args.sessionId,
      name: args.name,
      imageStorageId: args.imageStorageId,
      order,
    });

    // Create default sets
    for (let i = 1; i <= numSets; i++) {
      await ctx.db.insert("sets", {
        sessionExerciseId: exerciseId,
        setNumber: i,
        reps: numReps,
        completed: false,
      });
    }

    return exerciseId;
  },
});

// Complete a workout session
export const complete = mutation({
  args: { id: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      completed: true,
      completedAt: Date.now(),
    });
  },
});

// Delete a session and all its data
export const remove = mutation({
  args: { id: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("sessionExercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    for (const exercise of exercises) {
      // Delete sets
      const sets = await ctx.db
        .query("sets")
        .withIndex("by_exercise", (q) => q.eq("sessionExerciseId", exercise._id))
        .collect();

      for (const set of sets) {
        await ctx.db.delete(set._id);
      }

      await ctx.db.delete(exercise._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Update a set (weight, reps, completed)
export const updateSet = mutation({
  args: {
    id: v.id("sets"),
    weight: v.optional(v.number()),
    reps: v.optional(v.number()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates: Record<string, any> = {};
    if (updates.weight !== undefined) cleanUpdates.weight = updates.weight;
    if (updates.reps !== undefined) cleanUpdates.reps = updates.reps;
    if (updates.completed !== undefined) cleanUpdates.completed = updates.completed;

    await ctx.db.patch(id, cleanUpdates);
  },
});

// Add a new set to an exercise in a session
export const addSet = mutation({
  args: {
    sessionExerciseId: v.id("sessionExercises"),
    reps: v.number(),
    weight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_exercise", (q) => q.eq("sessionExerciseId", args.sessionExerciseId))
      .collect();

    const maxSetNumber = sets.length > 0
      ? Math.max(...sets.map((s) => s.setNumber))
      : 0;

    const setId = await ctx.db.insert("sets", {
      sessionExerciseId: args.sessionExerciseId,
      setNumber: maxSetNumber + 1,
      weight: args.weight,
      reps: args.reps,
      completed: false,
    });

    return setId;
  },
});

// Remove a set
export const removeSet = mutation({
  args: { id: v.id("sets") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Get session progress (completed sets / total sets)
export const getProgress = query({
  args: { id: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("sessionExercises")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    let totalSets = 0;
    let completedSets = 0;

    for (const exercise of exercises) {
      const sets = await ctx.db
        .query("sets")
        .withIndex("by_exercise", (q) => q.eq("sessionExerciseId", exercise._id))
        .collect();

      totalSets += sets.length;
      completedSets += sets.filter((s) => s.completed).length;
    }

    return {
      total: totalSets,
      completed: completedSets,
      percentage: totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0,
    };
  },
});
