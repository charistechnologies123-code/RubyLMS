import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function upsertUser({
  fullName,
  email,
  role,
  studentId,
}: {
  fullName: string;
  email: string;
  role: "ADMIN" | "INSTRUCTOR" | "STUDENT";
  studentId?: string;
}) {
  return prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role,
      studentId: studentId ?? null,
      status: "ACTIVE",
    },
    create: {
      fullName,
      email,
      role,
      studentId: studentId ?? null,
      status: "ACTIVE",
      passwordHash: await bcrypt.hash("Admin@123", 10),
    },
  });
}

async function main() {
  const admin = await upsertUser({
    fullName: "Ruby LMS Administrator",
    email: "admin@rubylms.com",
    role: "ADMIN",
  });

  const instructor = await upsertUser({
    fullName: "Ada Instructor",
    email: "instructor@rubylms.com",
    role: "INSTRUCTOR",
  });

  const studentOne = await upsertUser({
    fullName: "Grace Student",
    email: "student1@rubylms.com",
    role: "STUDENT",
    studentId: "RBY-GRA-0001",
  });

  const studentTwo = await upsertUser({
    fullName: "Samuel Learner",
    email: "student2@rubylms.com",
    role: "STUDENT",
    studentId: "RBY-SAM-0002",
  });

  const course = await prisma.course.upsert({
    where: { slug: "digital-product-foundations" },
    update: {
      title: "Digital Product Foundations",
      description:
        "A guided introduction to product thinking, communication, and execution for modern digital teams.",
      status: "PUBLISHED",
      instructorId: instructor.id,
      createdById: admin.id,
    },
    create: {
      title: "Digital Product Foundations",
      slug: "digital-product-foundations",
      description:
        "A guided introduction to product thinking, communication, and execution for modern digital teams.",
      status: "PUBLISHED",
      createdById: admin.id,
      instructorId: instructor.id,
    },
  });

  await prisma.enrollment.upsert({
    where: {
      studentId_courseId: {
        studentId: studentOne.id,
        courseId: course.id,
      },
    },
    update: {},
    create: {
      studentId: studentOne.id,
      courseId: course.id,
    },
  });

  await prisma.enrollment.upsert({
    where: {
      studentId_courseId: {
        studentId: studentTwo.id,
        courseId: course.id,
      },
    },
    update: {},
    create: {
      studentId: studentTwo.id,
      courseId: course.id,
    },
  });

  const lessonOne = await prisma.lesson.upsert({
    where: {
      courseId_slug: {
        courseId: course.id,
        slug: "product-mindset",
      },
    },
    update: {
      title: "Product Mindset",
      order: 1,
      content:
        "Learn how strong product teams frame problems, define outcomes, and stay close to user needs.",
      status: "PUBLISHED",
    },
    create: {
      courseId: course.id,
      title: "Product Mindset",
      slug: "product-mindset",
      order: 1,
      content:
        "Learn how strong product teams frame problems, define outcomes, and stay close to user needs.",
      status: "PUBLISHED",
    },
  });

  const lessonTwo = await prisma.lesson.upsert({
    where: {
      courseId_slug: {
        courseId: course.id,
        slug: "delivery-rhythm",
      },
    },
    update: {
      title: "Delivery Rhythm",
      order: 2,
      content:
        "Explore practical planning cycles, lightweight reporting, and team rituals that sustain momentum.",
      status: "PUBLISHED",
    },
    create: {
      courseId: course.id,
      title: "Delivery Rhythm",
      slug: "delivery-rhythm",
      order: 2,
      content:
        "Explore practical planning cycles, lightweight reporting, and team rituals that sustain momentum.",
      status: "PUBLISHED",
    },
  });

  const lessonPageOne = await prisma.lessonPage.upsert({
    where: {
      lessonId_slug: {
        lessonId: lessonOne.id,
        slug: "introduction-to-product-thinking",
      },
    },
    update: {
      title: "Introduction to Product Thinking",
      order: 1,
      body:
        "This page introduces the core ideas behind product thinking and why learner-centered problem framing matters.",
      externalUrl: "https://example.com/product-thinking",
    },
    create: {
      lessonId: lessonOne.id,
      title: "Introduction to Product Thinking",
      slug: "introduction-to-product-thinking",
      order: 1,
      body:
        "This page introduces the core ideas behind product thinking and why learner-centered problem framing matters.",
      externalUrl: "https://example.com/product-thinking",
    },
  });

  await prisma.lessonPage.upsert({
    where: {
      lessonId_slug: {
        lessonId: lessonOne.id,
        slug: "types-of-digital-tools",
      },
    },
    update: {
      title: "Types of Digital Tools",
      order: 2,
      body:
        "Explore collaboration tools, research tools, content platforms, and delivery systems commonly used in digital learning teams.",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
    create: {
      lessonId: lessonOne.id,
      title: "Types of Digital Tools",
      slug: "types-of-digital-tools",
      order: 2,
      body:
        "Explore collaboration tools, research tools, content platforms, and delivery systems commonly used in digital learning teams.",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
  });

  await prisma.resource.upsert({
    where: { id: "rubylms-seed-resource-1" },
    update: {
      title: "Course handbook",
      type: "PDF",
      courseId: course.id,
      lessonId: lessonOne.id,
      lessonPageId: lessonPageOne.id,
      externalUrl: "https://example.com/course-handbook.pdf",
    },
    create: {
      id: "rubylms-seed-resource-1",
      title: "Course handbook",
      type: "PDF",
      courseId: course.id,
      lessonId: lessonOne.id,
      lessonPageId: lessonPageOne.id,
      externalUrl: "https://example.com/course-handbook.pdf",
    },
  });

  await prisma.resource.upsert({
    where: { id: "rubylms-seed-resource-2" },
    update: {
      title: "Sprint review recording",
      type: "VIDEO_LINK",
      courseId: course.id,
      lessonId: lessonTwo.id,
      externalUrl: "https://example.com/sprint-review-video",
    },
    create: {
      id: "rubylms-seed-resource-2",
      title: "Sprint review recording",
      type: "VIDEO_LINK",
      courseId: course.id,
      lessonId: lessonTwo.id,
      externalUrl: "https://example.com/sprint-review-video",
    },
  });

  const assignment = await prisma.assignment.upsert({
    where: {
      id: "rubylms-seed-assignment",
    },
    update: {
      title: "Reflection Essay",
      description: "Summarize how a learner-centered workflow improves product outcomes.",
      instructions: "Submit a short written reflection or a shareable document link.",
      submissionType: "TEXT",
      dueAt: new Date("2026-05-01T12:00:00.000Z"),
      courseId: course.id,
      lessonId: lessonTwo.id,
      createdById: instructor.id,
    },
    create: {
      id: "rubylms-seed-assignment",
      title: "Reflection Essay",
      description: "Summarize how a learner-centered workflow improves product outcomes.",
      instructions: "Submit a short written reflection or a shareable document link.",
      submissionType: "TEXT",
      dueAt: new Date("2026-05-01T12:00:00.000Z"),
      courseId: course.id,
      lessonId: lessonTwo.id,
      createdById: instructor.id,
    },
  });

  const announcement = await prisma.announcement.upsert({
    where: { id: "rubylms-seed-announcement" },
    update: {
      title: "Welcome to Ruby LMS",
      content:
        "This seeded course is ready for testing. Review the lessons, submit the assignment, and explore the quiz flow.",
      courseId: course.id,
      createdById: instructor.id,
    },
    create: {
      id: "rubylms-seed-announcement",
      title: "Welcome to Ruby LMS",
      content:
        "This seeded course is ready for testing. Review the lessons, submit the assignment, and explore the quiz flow.",
      courseId: course.id,
      createdById: instructor.id,
    },
  });

  const question = await prisma.courseQuestion.upsert({
    where: { id: "rubylms-seed-question" },
    update: {
      title: "How should we structure our weekly reflection?",
      content: "Is there a preferred format for the assignment reflection this week?",
      courseId: course.id,
      askedById: studentOne.id,
    },
    create: {
      id: "rubylms-seed-question",
      title: "How should we structure our weekly reflection?",
      content: "Is there a preferred format for the assignment reflection this week?",
      courseId: course.id,
      askedById: studentOne.id,
    },
  });

  await prisma.courseQuestionAnswer.upsert({
    where: { id: "rubylms-seed-answer" },
    update: {
      content: "A concise one-page response is enough. Focus on clarity, examples, and what you learned.",
      questionId: question.id,
      answeredById: instructor.id,
    },
    create: {
      id: "rubylms-seed-answer",
      content: "A concise one-page response is enough. Focus on clarity, examples, and what you learned.",
      questionId: question.id,
      answeredById: instructor.id,
    },
  });

  const quiz = await prisma.quiz.upsert({
    where: { id: "rubylms-seed-quiz" },
    update: {
      title: "Foundations Checkpoint",
      description: "A short review of key ideas from the first two lessons.",
      instructions: "Answer each question and submit once you are confident.",
      status: "PUBLISHED",
      timeLimitMinutes: 15,
      maxAttempts: 2,
      showScoreImmediately: true,
      courseId: course.id,
      lessonId: lessonTwo.id,
      createdById: instructor.id,
    },
    create: {
      id: "rubylms-seed-quiz",
      title: "Foundations Checkpoint",
      description: "A short review of key ideas from the first two lessons.",
      instructions: "Answer each question and submit once you are confident.",
      status: "PUBLISHED",
      timeLimitMinutes: 15,
      maxAttempts: 2,
      showScoreImmediately: true,
      courseId: course.id,
      lessonId: lessonTwo.id,
      createdById: instructor.id,
    },
  });

  const questionBank = await prisma.questionBankItem.upsert({
    where: { id: "rubylms-seed-question-bank-1" },
    update: {
      questionText: "Which action best reflects a learner-centered mindset?",
      questionType: "SINGLE_CHOICE",
      marks: 1,
      courseId: course.id,
    },
    create: {
      id: "rubylms-seed-question-bank-1",
      questionText: "Which action best reflects a learner-centered mindset?",
      questionType: "SINGLE_CHOICE",
      marks: 1,
      courseId: course.id,
    },
  });

  await prisma.questionOption.upsert({
    where: {
      questionBankId_order: {
        questionBankId: questionBank.id,
        order: 1,
      },
    },
    update: {
      optionText: "Understand the learner problem before proposing a solution",
      isCorrect: true,
    },
    create: {
      questionBankId: questionBank.id,
      order: 1,
      optionText: "Understand the learner problem before proposing a solution",
      isCorrect: true,
    },
  });

  await prisma.questionOption.upsert({
    where: {
      questionBankId_order: {
        questionBankId: questionBank.id,
        order: 2,
      },
    },
    update: {
      optionText: "Skip feedback cycles to save time",
      isCorrect: false,
    },
    create: {
      questionBankId: questionBank.id,
      order: 2,
      optionText: "Skip feedback cycles to save time",
      isCorrect: false,
    },
  });

  await prisma.quizQuestion.upsert({
    where: {
      quizId_questionBankId: {
        quizId: quiz.id,
        questionBankId: questionBank.id,
      },
    },
    update: { order: 1 },
    create: {
      quizId: quiz.id,
      questionBankId: questionBank.id,
      order: 1,
    },
  });

  await prisma.notification.upsert({
    where: { id: "rubylms-seed-notification-1" },
    update: {
      userId: studentOne.id,
      title: "Seeded course ready",
      message: `You have been enrolled in ${course.title}.`,
    },
    create: {
      id: "rubylms-seed-notification-1",
      userId: studentOne.id,
      title: "Seeded course ready",
      message: `You have been enrolled in ${course.title}.`,
    },
  });

  await prisma.notification.upsert({
    where: { id: "rubylms-seed-notification-2" },
    update: {
      userId: studentTwo.id,
      title: "New announcement available",
      message: `${announcement.title} has been posted.`,
    },
    create: {
      id: "rubylms-seed-notification-2",
      userId: studentTwo.id,
      title: "New announcement available",
      message: `${announcement.title} has been posted.`,
    },
  });

  await prisma.auditLog.upsert({
    where: { id: "rubylms-seed-audit-1" },
    update: {
      actorId: admin.id,
      action: "SEED_USER_SETUP",
      targetType: "User",
      targetId: studentOne.id,
      details: "Seeded starter accounts",
    },
    create: {
      id: "rubylms-seed-audit-1",
      actorId: admin.id,
      action: "SEED_USER_SETUP",
      targetType: "User",
      targetId: studentOne.id,
      details: "Seeded starter accounts",
    },
  });

  await prisma.auditLog.upsert({
    where: { id: "rubylms-seed-audit-2" },
    update: {
      actorId: admin.id,
      action: "SEED_COURSE_SETUP",
      targetType: "Course",
      targetId: course.id,
      details: "Seeded demo LMS course",
    },
    create: {
      id: "rubylms-seed-audit-2",
      actorId: admin.id,
      action: "SEED_COURSE_SETUP",
      targetType: "Course",
      targetId: course.id,
      details: "Seeded demo LMS course",
    },
  });

  console.log("Seed complete.");
  console.log("Admin login: admin@rubylms.com / Admin@123");
  console.log("Instructor login: instructor@rubylms.com / Admin@123");
  console.log("Student login: student1@rubylms.com or RBY-GRA-0001 / Admin@123");
  console.log(`Seeded course: ${course.title}`);
  console.log(`Seeded assignment: ${assignment.title}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
